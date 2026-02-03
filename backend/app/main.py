from flask import Flask, jsonify
from app.routers.search import search_bp
from flask_cors import CORS

def create_app():
    app = Flask(__name__)

    CORS(app, resources={r"/*": {"origins": "https://gazawayj.github.io"}})

    # Register blueprints
    app.register_blueprint(search_bp)

    # Root path
    @app.route("/")
    def root():
        return jsonify(status="GIS Backend is running")

    return app

app = create_app()
