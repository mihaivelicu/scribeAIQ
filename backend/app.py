# app.py
from flask import Flask
from models import db
import config
from routes import routes_blueprint

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = config.DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB

    db.init_app(app)
    app.register_blueprint(routes_blueprint, url_prefix="/api")

    return app

# Create a global 'app' variable for 'flask run'
app = create_app()
