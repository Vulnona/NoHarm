import pytest
from app import create_app, get_db_connection

# Dummy classes to simulate database behavior for testing
class DummyDBResponse:
    def __init__(self, rows):
        self.rows = rows

    def fetchall(self):
        return self.rows


class DummyDBConnection:
    @staticmethod
    def execute(query, params=None):
        # For SELECT queries return dummy data;
        # for INSERT/UPDATE pass
        if "SELECT" in query.upper():
            return DummyDBResponse([("col1", "value1"), ("col2", "value2")])
        else:
            return None

    def commit(self):
        pass

@pytest.fixture
def app():
    # Make sure create_app() returns a valid app object
    app = create_app()
    app.config.update({"TESTING": True})

    with app.app_context():
        yield app


@pytest.fixture
def client(monkeypatch, app):
    """
    Pytest fixture to set up a test client for the app.
    1. get_db_connection (and optionally get_db_conn) with DummyDBConnection,
    2. render_template to control template output in tests,
    3. abort to simulate error conditions.
    """
    # Set app testing configuration if necessary
    # app.config["TESTING"] = True

    # monkeypatch get_db_connection to return a dummy connection.
    monkeypatch.setattr(app, "get_db_connection", lambda: DummyDBConnection())

    # Optionally, patch render_template to use dummy templates.
    def dummy_render(template_name, **context):
        if template_name == "group_preferences.html":
            question = context.get("question", "")
            next_index = context.get("next_index", "")
            return f"Rendered: {question} (next index: {next_index})"
        elif template_name == "thank_you.html":
            return "Thank You Page"
        elif template_name == "no_consent.html":
            return "No Consent Page"
        elif template_name == "admin.html":
            return "Admin Dashboard"
        elif template_name == "results.html":
            results = context.get("results", [])
            return f"Results: {results}"
        else:
            # Fallback
            return ""

    monkeypatch.setattr(app, "render_template", dummy_render)

    # Patch abort to raise an exception.
    from werkzeug.exceptions import HTTPException

    def dummy_abort(status_code):
        raise HTTPException(description="Aborted", response=None)

    monkeypatch.setattr(app, "abort", dummy_abort)

    return app.test_client()
