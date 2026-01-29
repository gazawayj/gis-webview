def test_mola_returns_feature_collection(client):
    res = client.get("/api/mola")
    body = res.json()

    assert res.status_code == 200
    assert body["type"] == "FeatureCollection"
    assert isinstance(body["features"], list)