# services.py
import os
import openai
from models import db, Session, Template, Interpretation
import config
import json
from datetime import datetime, timedelta

openai.api_key = config.OPENAI_API_KEY



def generate_short_title(transcription_text):
    """
    Given a session transcription, use ChatGPT (GPT-4) to generate a short title.
    The title must be no longer than 20 characters.
    The response must be a JSON with a single key "title".
    """

    prompt = f"""You are in the backend of a medical scribe webapp. This is the session transcription: 
    <transcription>{transcription_text}</transcription>.

    Generate a short title for this session that is no longer than 20 characters. 
    Words must fit inside the 20 characters, not cutting words at the end. 
    Do not unnecessarily capitalise the first letter of every word, unless its the first word in the whole title, or the word has to have capital letters.
    Output your answer strictly in JSON format with a single key "title", for example:
    {{"title": "Your title"}}. VERY IMPORTANT: Return only pure JSON, no other text, no other symbols, nothing else other than pure json. Your returned reply needs to be correctly read as json by a python script and it must contain absolutely nothing else other than the json requested."""
    print('tra---', transcription_text)
    try:
        response = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a concise assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=30,
        )
        # Extract the message content
        print('res---', response)
        message_content = response.choices[0].message['content']
        # Parse the response as JSON
        print('mes---', message_content)
        result = json.loads(message_content)
        print('res2---', result)
        title = result.get("title", "").strip()[:22]
        print('title---', title)
        return title
    except Exception as e:
        print("Error generating short title:", e)
        # Fallback to a default if needed
        return "Untitled session"

def transcribe_audio_file(mp3_path: str, session: Session):
    """
    Transcribe the given MP3 with Whisper, save the text to the session,
    then delete the audio file from disk and clear session.audio_file_path.
    """
    if not mp3_path or not os.path.exists(mp3_path):
        raise FileNotFoundError("Audio file path is invalid or does not exist.")

    # --- Whisper ---
    with open(mp3_path, "rb") as audio_file:
        response = openai.Audio.transcribe("whisper-1", audio_file)

    # --- Save transcript ---
    session.transcription_text = response["text"]
    session.transcription_expires_at = datetime.utcnow() + timedelta(hours=24)

    # --- Remove audio ---
    try:
        os.remove(mp3_path)
    except Exception as e:
        print(f"Warning: could not delete {mp3_path}: {e}")

    session.audio_file_path = None
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
    prompt_text = f"""You are a clinical scribe. 
    You will take this transcription of a clinician's session: 
    TRANSCRIPTION:
    '''{session_obj.transcription_text}'''
    and you will return a formatted session note according to this note template:
    TEMPLATE:
    '''{template_obj.template_text}'''
    """
    
    # Call OpenAI ChatCompletion
    response = openai.ChatCompletion.create(
        model="gpt-4o",
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
