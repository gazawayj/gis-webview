def get_mola_features():
    """
    Returns sample MOLA features for GIS testing.
    """
    return [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [0, 0]},
        "properties": {"name": "Prime Meridian Center"}
    }]
