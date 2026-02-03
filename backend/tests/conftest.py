import pytest
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)