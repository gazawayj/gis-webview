from flask import Blueprint, jsonify

mola_bp = Blueprint("mola", __name__)

@mola_bp.route("", methods=["GET"])
def get_mola_features():
    return jsonify([{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [0, 0]},
        "properties": {"name": "Prime Meridian Center"}
    }])
