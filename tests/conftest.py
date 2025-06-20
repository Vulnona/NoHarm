# conftest.py
import pytest
from app import app # Import your Flask app instance

@pytest.fixture
def flask_app():
    """
    Fixture that provides the Flask application instance.
    This can be used to access the app's configuration or other properties.
    """
    app.config.update({
        "TESTING": True,  # Enable Flask's testing mode
    })
    yield app  # Provide the app to the tests

@pytest.fixture
def client(flask_app):
    """
    Fixture that provides a test client for the Flask application.
    This client allows sending requests to the app without running a server.
    """
    return flask_app.test_client()