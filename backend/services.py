# services.py
import os
import openai
from models import db, Session, Template, Interpretation
import config

openai.api_key = config.OPENAI_API_KEY

def transcribe_audio_file(mp3_path: str, session: Session):
    """
    Calls OpenAI Whisper to transcribe the audio file at mp3_path.
    Updates session.transcription_text in the database.
    """
    if not mp3_path or not os.path.exists(mp3_path):
        raise FileNotFoundError("Audio file path is invalid or does not exist.")
    
    # OpenAI Whisper API call
    with open(mp3_path, "rb") as audio_file:
        response = openai.Audio.transcribe("whisper-1", audio_file)
    
    # Update the transcription_text in the database
    session.transcription_text = response["text"]
    db.session.commit()

def generate_interpretation(session_id: int, template_id: int) -> Interpretation:
    """
    Takes a session_id and template_id, fetches the objects,
    calls GPT to generate text, saves the Interpretation in the database,
    and returns the created Interpretation.
    """
    session_obj = Session.query.get(session_id)
    template_obj = Template.query.get(template_id)
    if not session_obj or not template_obj:
        raise ValueError("Invalid Session or Template ID.")
    
    if not session_obj.transcription_text:
        raise ValueError("No transcription available for this session.")
    
    # Build the prompt using the template and transcription
    prompt_text = f"You are a clinical scribe. You will take this transcription of a clinician's session: TRANSCRIPTION: '''{session_obj.transcription_text}''' and you will return a formatted session note according to this note template: '''{template_obj.template_text}'''"
    
    # Call OpenAI ChatCompletion
    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt_text}]
    )
    generated = response.choices[0].message.content.strip()
    
    # Create the Interpretation record
    interpretation = Interpretation(
        session_id=session_obj.session_id,
        template_id=template_obj.template_id,
        generated_text=generated
    )
    db.session.add(interpretation)
    print(generated)
    
    # Increment times_used for the template
    template_obj.times_used += 1
    
    db.session.commit()
    
    return interpretation
