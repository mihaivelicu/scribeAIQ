# app.py
from flask import Flask
from models import db
import config
from routes import routes_blueprint
from flask_migrate import Migrate
from flask_apscheduler import APScheduler
from datetime import datetime

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = config.DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB

    db.init_app(app)

    # Initialize Flask-Migrate
    Migrate(app, db)  # no need to store in a variable

    # ── Scheduler ────────────────────────────────────────────────
    class Config: SCHEDULER_API_ENABLED = True
    app.config.from_object(Config())
    scheduler = APScheduler()

    @scheduler.task('cron', id='purge_expired', hour='*')  # run hourly
    def purge_expired():
        with app.app_context():
            now = datetime.utcnow()
            expired = Session.query.filter(
                Session.transcription_expires_at <= now,
                Session.transcription_text.isnot(None)
            )
            for s in expired:
                s.transcription_text      = None
                s.transcription_expires_at = None
            if expired.count():
                db.session.commit()

    scheduler.init_app(app)
    scheduler.start()
    # ─────────────────────────────────────────────────────────────

    app.register_blueprint(routes_blueprint, url_prefix="/api")

    return app

# Create a global 'app' variable for 'flask run'
app = create_app()
