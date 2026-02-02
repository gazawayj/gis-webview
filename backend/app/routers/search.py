from flask import Blueprint, request, jsonify
from app.services.gemini import ai_search

search_bp = Blueprint("search", __name__)

@search_bp.route("/", methods=["GET"])
def search():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "No query provided"}), 400

    result = ai_search(query)

    # If AI returns a string JSON, parse it
    if isinstance(result, str):
        try:
            import json
            result = json.loads(result)
        except Exception:
            pass

    return jsonify(result)
