# routes.py
import os
import subprocess
from flask import Blueprint, request, jsonify
from models import db, Session, Template, Interpretation
import config
from services import transcribe_audio_file, generate_interpretation
import uuid
import ffmpeg  # optional if you have a python-ffmpeg binding, or just call subprocess
import shutil


routes_blueprint = Blueprint("routes_blueprint", __name__)

# -------------------------------------------------------------------
# SESSIONS ROUTES
# -------------------------------------------------------------------

@routes_blueprint.route("/sessions", methods=["POST"])
def create_session():
    """Create a new session record."""
    data = request.get_json() or {}
    title = data.get("session_title", "")
    new_sess = Session(session_title=title)
    db.session.add(new_sess)
    db.session.commit()

    return jsonify({
        "session_id": new_sess.session_id,
        "session_title": new_sess.session_title,
        "created_at": new_sess.created_at.isoformat()
    }), 201

@routes_blueprint.route("/sessions", methods=["GET"])
def list_sessions():
    """List all sessions."""
    sessions = Session.query.order_by(Session.created_at.desc()).all()
    results = []
    for s in sessions:
        results.append({
            "session_id": s.session_id,
            "session_title": s.session_title,
            "created_at": s.created_at.isoformat()
        })
    return jsonify(results), 200

@routes_blueprint.route("/sessions/<int:session_id>", methods=["GET"])
def get_session_details(session_id):
    """Get the full details of a single session."""
    s = Session.query.get(session_id)
    if not s:
        return jsonify({"error": "Session not found"}), 404

    return jsonify({
        "session_id": s.session_id,
        "session_title": s.session_title,
        "audio_file_path": s.audio_file_path,
        "transcription_text": s.transcription_text,
        "created_at": s.created_at.isoformat()
    }), 200

@routes_blueprint.route("/sessions/<int:session_id>", methods=["PUT"])
def update_session(session_id):
    s = Session.query.get(session_id)
    if not s:
        return jsonify({"error": "Session not found"}), 404
    data = request.get_json() or {}
    new_title = data.get("session_title", "").strip()
    if new_title == "":
        new_title = "Untitled session"
    s.session_title = new_title
    db.session.commit()
    return jsonify({
        "session_id": s.session_id,
        "session_title": s.session_title,
        "created_at": s.created_at.isoformat()
    }), 200

@routes_blueprint.route("/sessions/<int:session_id>", methods=["DELETE"])
def delete_session(session_id):
    s = Session.query.get(session_id)
    if not s:
        return jsonify({"error": "Session not found"}), 404
    try:
        # Optionally, log the number of related interpretations
        print(f"Deleting session {session_id} with {len(s.interpretations)} interpretations.")
        
        db.session.delete(s)
        db.session.commit()
        return jsonify({"message": "Session deleted"}), 200
    except Exception as e:
        # Log full error traceback for debugging
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@routes_blueprint.route("/sessions/<int:session_id>/audio", methods=["POST"])
def upload_audio(session_id):
    s = Session.query.get(session_id)
    if not s:
        print("Session not found")
        return jsonify({"error": "Session not found"}), 404

    if "file" not in request.files:
        print("No file provided")
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        print("Empty filename")
        return jsonify({"error": "Empty filename"}), 400

    os.makedirs(config.AUDIO_UPLOAD_FOLDER, exist_ok=True)
    
    # If the uploaded file is an MP3, save it directly
    if file.filename.lower().endswith('.mp3'):
        saved_mp3_path = os.path.join(config.AUDIO_UPLOAD_FOLDER, f"session_{session_id}_{file.filename}")
        try:
            print("Saving MP3 file to:", saved_mp3_path)
            file.save(saved_mp3_path)
        except Exception as e:
            print("Error saving file:", e)
            return jsonify({"error": f"Error saving file: {str(e)}"}), 500
        mp3_path = saved_mp3_path
    else:
        # Otherwise, assume it's in WebM format and convert it to MP3
        saved_webm_path = os.path.join(config.AUDIO_UPLOAD_FOLDER, f"session_{session_id}_{file.filename}")
        try:
            print("Saving file to:", saved_webm_path)
            file.save(saved_webm_path)
            print("File saved successfully.")
        except Exception as e:
            print("Error saving file:", e)
            return jsonify({"error": f"Error saving file: {str(e)}"}), 500

        mp3_filename = os.path.splitext(file.filename)[0] + ".mp3"
        mp3_path = os.path.join(config.AUDIO_UPLOAD_FOLDER, f"session_{session_id}_{mp3_filename}")
        try:
            print("Converting file to MP3:", mp3_path)
            subprocess.run(
                ["ffmpeg", "-i", saved_webm_path, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "192k", mp3_path],
                check=True
            )
            print("Conversion successful.")
            os.remove(saved_webm_path)
        except Exception as e:
            print("Error converting file:", e)
            return jsonify({"error": f"Error converting file: {str(e)}"}), 500

    try:
        transcribe_audio_file(mp3_path, s)
        print("Transcription successful.")
    except Exception as e:
        print("Error during transcription:", e)
        return jsonify({"error": f"Error during transcription: {str(e)}"}), 500
    
    # NEW: If the session title is still "Untitled session" and transcription is available,
    # generate a short title via ChatGPT.
    if s.session_title.strip().lower() == "untitled session" and s.transcription_text:
        from services import generate_short_title  # Ensure this import is at the top or here
        new_title = generate_short_title(s.transcription_text)
        print(f"Auto-generated title: {new_title}")
        s.session_title = new_title
        db.session.commit()

    try:
        s.audio_file_path = "/audio/" + os.path.basename(mp3_path)
        db.session.commit()
        print("Session record updated successfully.")
    except Exception as e:
        print("Error updating session record:", e)
        return jsonify({"error": f"Error updating session record: {str(e)}"}), 500

    return jsonify({"message": "Audio uploaded, processed, and transcribed successfully"}), 200


# -------------------------------------------------------------------
# TEMPLATES ROUTES
# -------------------------------------------------------------------

@routes_blueprint.route("/templates", methods=["POST"])
def create_template():
    """Create a new template."""
    data = request.get_json() or {}
    name = data.get("template_name")
    text = data.get("template_text")
    if not name or not text:
        return jsonify({"error": "Missing template_name or template_text"}), 400

    new_tmpl = Template(
        template_name=name,
        template_text=text
    )
    db.session.add(new_tmpl)
    db.session.commit()

    return jsonify({
        "template_id": new_tmpl.template_id,
        "template_name": new_tmpl.template_name,
        "created_at": new_tmpl.created_at.isoformat()
    }), 201

@routes_blueprint.route("/sessions/<int:session_id>/audio", methods=["DELETE"])
def delete_audio_file(session_id):
    """
    Deletes the audio file from the server for a given session
    and sets session.audio_file_path = None.
    """
    s = Session.query.get(session_id)
    if not s:
        return jsonify({"error": "Session not found"}), 404
    
    if not s.audio_file_path:
        return jsonify({"error": "No audio file set in this session"}), 400

    # Full path on disk
    file_basename = os.path.basename(s.audio_file_path)  # e.g. "session_123_anything.mp3"
    file_path = os.path.join(config.AUDIO_UPLOAD_FOLDER, file_basename)

    # Delete from disk if it exists
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            return jsonify({"error": f"Error deleting file: {str(e)}"}), 500

    # Update the DB record
    s.audio_file_path = None
    db.session.commit()
    return jsonify({"message": "Audio file deleted"}), 200

@routes_blueprint.route("/templates", methods=["GET"])
def list_templates():
    """List all templates."""
    templates = Template.query.order_by(Template.created_at.desc()).all()
    results = []
    for t in templates:
        results.append({
            "template_id": t.template_id,
            "template_name": t.template_name,
            "template_text": t.template_text,
            "times_used": t.times_used,
            "created_at": t.created_at.isoformat(),
            "favorite": t.favorite  # Added favorite field here
        })
    return jsonify(results), 200

# -------------------------------------------------------------------
# INTERPRETATIONS ROUTES
# -------------------------------------------------------------------

@routes_blueprint.route("/interpretations", methods=["POST"])
def create_interpretation_record():
    """
    Generate a new interpretation by applying a template to a session's transcription.
    """
    data = request.get_json() or {}
    session_id = data.get("session_id")
    template_id = data.get("template_id")
    if not session_id or not template_id:
        return jsonify({"error": "Missing session_id or template_id"}), 400

    try:
        interpretation = generate_interpretation(session_id, template_id)
        return jsonify({
            "interpretation_id": interpretation.interpretation_id,
            "generated_text": interpretation.generated_text,
            "session_id": interpretation.session_id,
            "template_id": interpretation.template_id,
            "created_at": interpretation.created_at.isoformat()
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@routes_blueprint.route("/interpretations", methods=["GET"])
def list_interpretations():
    """
    List interpretations, optionally filtered by session_id.
    """
    session_id = request.args.get("session_id")
    query = Interpretation.query
    if session_id:
        query = query.filter(Interpretation.session_id == session_id)

    interpretations = query.order_by(Interpretation.created_at.desc()).all()
    results = []
    for i in interpretations:
        results.append({
            "interpretation_id": i.interpretation_id,
            "session_id": i.session_id,
            "template_id": i.template_id,
            "generated_text": i.generated_text,
            "created_at": i.created_at.isoformat()
        })
    return jsonify(results), 200

# routes.py (add these imports at the top if needed)

@routes_blueprint.route("/sessions/<int:session_id>/chunks", methods=["POST"])
def upload_chunk(session_id):
    """
    Upload a partial MP3 chunk for a given session.
    We'll store it in a temp folder, e.g. /audio_uploads/temp_chunks/session_123_<unique>.mp3
    """
    s = Session.query.get(session_id)
    if not s:
        return jsonify({"error": "Session not found"}), 404

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    # Generate a unique chunk filename
    chunk_filename = f"chunk_{uuid.uuid4()}.mp3"
    temp_dir = os.path.join(config.AUDIO_UPLOAD_FOLDER, "temp_chunks", f"session_{session_id}")
    os.makedirs(temp_dir, exist_ok=True)

    saved_path = os.path.join(temp_dir, chunk_filename)
    try:
        file.save(saved_path)
    except Exception as e:
        return jsonify({"error": f"Error saving chunk: {str(e)}"}), 500

    return jsonify({
        "message": "Partial chunk uploaded",
        "chunk_filename": chunk_filename
    }), 200


@routes_blueprint.route("/sessions/<int:session_id>/merge-chunks", methods=["POST"])
def merge_chunks(session_id):
    """
    Takes all partial chunk files from /temp_chunks/session_<id>/,
    merges them with ffmpeg in correct chronological order,
    transcribes the final result, updates session audio_file_path.
    """
    s = Session.query.get(session_id)
    if not s:
        return jsonify({"error": "Session not found"}), 404

    temp_dir = os.path.join(config.AUDIO_UPLOAD_FOLDER, "temp_chunks", f"session_{session_id}")
    if not os.path.exists(temp_dir):
        return jsonify({"error": "No partial chunks found"}), 400

    # Gather all chunk MP3s
    chunks = [f for f in os.listdir(temp_dir) if f.endswith(".mp3")]
    if not chunks:
        return jsonify({"error": "No chunk files found"}), 400

    # 1) Sort by file creation time so we get the chronological order
    chunks.sort(key=lambda fname: os.path.getctime(os.path.join(temp_dir, fname)))

    # 2) If there's only one chunk, no real merge needed; just rename
    if len(chunks) == 1:
        single_chunk_path = os.path.join(temp_dir, chunks[0])
        final_mp3_path = os.path.join(config.AUDIO_UPLOAD_FOLDER, f"session_{session_id}_merged.mp3")
        try:
            shutil.move(single_chunk_path, final_mp3_path)
        except Exception as e:
            return jsonify({"error": f"Error moving chunk: {str(e)}"}), 500
    else:
        # 3) For multiple chunks, create a list.txt and run ffmpeg concat
        list_path = os.path.join(temp_dir, "list.txt")
        with open(list_path, "w") as f:
            for c in chunks:
                f.write(f"file '{os.path.join(temp_dir, c)}'\n")

        final_mp3_path = os.path.join(config.AUDIO_UPLOAD_FOLDER, f"session_{session_id}_merged.mp3")

        merge_cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", list_path,
            "-c", "copy",
            final_mp3_path
        ]
        try:
            subprocess.run(merge_cmd, check=True)
        except Exception as e:
            return jsonify({"error": f"Error merging chunks: {str(e)}"}), 500

    # 4) Transcribe the merged MP3
    try:
        transcribe_audio_file(final_mp3_path, s)
    except Exception as e:
        return jsonify({"error": f"Error during transcription: {str(e)}"}), 500

    # NEW: Auto-update title if still default and transcription is available.
    if s.session_title.strip().lower() == "untitled session" and s.transcription_text:
        from services import generate_short_title  # Import if not already imported
        new_title = generate_short_title(s.transcription_text)
        print(f"Auto-generated title: {new_title}")
        s.session_title = new_title
        db.session.commit()

    # 5) Update session
    s.audio_file_path = "/audio/" + os.path.basename(final_mp3_path)
    db.session.commit()

    # 6) Optionally remove temp dir
    try:
        shutil.rmtree(temp_dir)
    except Exception as e:
        print(f"Warning: failed to remove temp dir {temp_dir}: {e}")

    return jsonify({"message": "Chunks merged & transcribed in correct order"}), 200

@routes_blueprint.route("/templates/<int:template_id>", methods=["PUT"])
def update_template(template_id):
    """Update an existing template by ID."""
    from models import Template, db
    t = Template.query.get(template_id)
    if not t:
        return jsonify({"error": "Template not found"}), 404

    data = request.get_json() or {}
    new_name = data.get("template_name")
    new_text = data.get("template_text")

    if not new_name or not new_text:
        return jsonify({"error": "template_name or template_text missing"}), 400

    t.template_name = new_name
    t.template_text = new_text
    db.session.commit()

    return jsonify({
        "template_id": t.template_id,
        "template_name": t.template_name,
        "template_text": t.template_text,
        "created_at": t.created_at.isoformat()
    }), 200


@routes_blueprint.route("/templates/<int:template_id>", methods=["DELETE"])
def delete_template(template_id):
    """Delete an existing template by ID."""
    from models import Template, db
    t = Template.query.get(template_id)
    if not t:
        return jsonify({"error": "Template not found"}), 404

    try:
        db.session.delete(t)
        db.session.commit()
    except Exception as e:
        db.session.rollback()  # rollback the session on error
        # Check if it's a foreign key violation (you can further inspect 'e' if needed)
        return jsonify({"error": "Template cannot be deleted because it is in use."}), 400

    return jsonify({"message": "Template deleted"}), 200

@routes_blueprint.route("/templates/<int:template_id>/favorite", methods=["PUT"])
def toggle_favorite(template_id):
    from models import Template, db
    t = Template.query.get(template_id)
    if not t:
        return jsonify({"error": "Template not found"}), 404

    data = request.get_json()
    if data is None or "favorite" not in data:
        return jsonify({"error": "Missing 'favorite' key in request"}), 400

    new_favorite = data["favorite"]
    t.favorite = new_favorite
    db.session.commit()

    return jsonify({
        "template_id": t.template_id,
        "favorite": t.favorite
    }), 200

