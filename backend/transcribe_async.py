# transcribe_async.py
import threading
from services import transcribe_audio_file
from models import db, Session

# A dictionary to track each session’s status
# e.g. TRANSCRIPTION_STATUS[123] = "pending" / "done" / "error"
TRANSCRIPTION_STATUS = {}

def start_transcription_in_thread(mp3_path, session_id):
    TRANSCRIPTION_STATUS[session_id] = "pending"

    def do_transcription():
        try:
            s = Session.query.get(session_id)
            if not s:
                TRANSCRIPTION_STATUS[session_id] = "error"
                return

            transcribe_audio_file(mp3_path, s)
            # Mark "done" in the dictionary
            TRANSCRIPTION_STATUS[session_id] = "done"
            # Save path to DB (the code below is example, adapt to your logic)
            s.audio_file_path = "/audio/" + mp3_path.split("/")[-1]
            db.session.commit()
        except Exception as e:
            print("Error in background transcription:", e)
            TRANSCRIPTION_STATUS[session_id] = "error"

    t = threading.Thread(target=do_transcription, daemon=True)
    t.start()
