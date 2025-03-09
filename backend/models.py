# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Session(db.Model):
    __tablename__ = 'sessions'

    session_id = db.Column(db.Integer, primary_key=True)
    session_title = db.Column(db.String(255), nullable=True)
    audio_file_path = db.Column(db.String(255), nullable=True)
    transcription_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Relationship to interpretations (with cascade deletion)
    interpretations = db.relationship('Interpretation', backref='session', cascade="all, delete-orphan")

class Template(db.Model):
    __tablename__ = 'templates'

    template_id = db.Column(db.Integer, primary_key=True)
    template_name = db.Column(db.String(255), nullable=False)
    template_text = db.Column(db.Text, nullable=False)
    times_used = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Interpretation(db.Model):
    __tablename__ = 'interpretations'

    interpretation_id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.session_id'), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey('templates.template_id'), nullable=False)
    generated_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
