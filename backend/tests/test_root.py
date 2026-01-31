def test_root(client):
    res = client.get("/")
    assert res.status_code == 200
    # Match the actual response structure
    data = res.json()
    assert data["message"] == "GIS Backend is running"
