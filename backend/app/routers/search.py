from flask import Blueprint, jsonify
from app.db import get_mola_features 

search_bp = Blueprint("search", __name__)

@search_bp.route("/mola", methods=["GET"])
def mola():
    features = get_mola_features()

    return jsonify({
        "type": "FeatureCollection",
        "features": features
    })
