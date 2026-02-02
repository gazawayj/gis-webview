import sys
import os

# Add your app directory to the Python path
path = "/home/yourusername/gis-webview/backend"
if path not in sys.path:
    sys.path.insert(0, path)

# Set environment variable for ASGI/UVicorn compatibility if needed
os.environ.setdefault("GENIE_API_KEY", os.environ.get("GENIE_API_KEY", "your_api_key_here"))

# Import FastAPI app
from app.main import app as application  # "application" is required by PythonAnywhere
