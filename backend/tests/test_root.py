def test_root(client):
    res = client.get("/")
    assert res.status_code == 200
    assert res.json() == {"status": "API running!"}