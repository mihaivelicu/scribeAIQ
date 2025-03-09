# routes.py
import os
import subprocess
from flask import Blueprint, request, jsonify
from models import db, Session, Template, Interpretation
import config
from services import transcribe_audio_file, generate_interpretation


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
            "created_at": t.created_at.isoformat()
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
