# init_db.py
from app import create_app
from models import db, Session, Template, Interpretation

app = create_app()

with app.app_context():
    db.create_all()
    print("Database tables created successfully.")
