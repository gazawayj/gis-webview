def test_mola_returns_feature_collection(client):
    response = client.get("/mola")
    data = response.get_json()

    assert response.status_code == 200
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0
