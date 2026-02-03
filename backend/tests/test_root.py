def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.get_json()["status"] == "GIS Backend is running"
