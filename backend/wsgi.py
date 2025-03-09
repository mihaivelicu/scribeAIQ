# wsgi.py
import eventlet
eventlet.monkey_patch()

from app import app  # Import the Flask app created in app.py
