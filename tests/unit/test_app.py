import json

from tests.conftest import client



def test_group_preferences_get_valid(client):
    """
    Test GET /group_preferences with a valid answer parameter.
    output has been simulated by the dummy render_template.
    """
    # Suppose your route uses the query parameter 'answer'
    response = client.get("/group_preferences?answer=0")
    assert response.status_code == 200
    data = response.data.decode("utf-8")
    # Our dummy function returns something like "Rendered: Question 1? (next index: 1)"
    assert "Rendered:" in data
    assert "next index" in data


def test_group_preferences_get_invalid(client):
    """
    Test GET /group_preferences with an invalid answer parameter.
    for example, a negative number might trigger a call to abort().
    """
    response = client.get("/group_preferences?answer=-1")
    # Since our dummy abort raises an exception, the status code may be 500
    assert response.status_code == 500


def test_group_preferences_post_no_session(client):
    """
    Test POST /group_preferences when no session is available.
    to simulate a redirect to a login route.
    """
    response = client.post("/group_preferences", data={"answer": "0"})
    # Typically, your app might redirect (HTTP 302) if the user isn’t logged in.
    assert response.status_code in (302, 301)
    location = response.location.decode("utf-8")
    assert "login" in location


def test_group_preferences_post_valid(client):
    """
    Test POST /group_preferences with a valid session.
    to redirect to the next page.
    """
    # Simulate a logged-in user
    client.session["user_id"] = 123

    response = client.post("/group_preferences", data={"answer": "0"})
    assert response.status_code in (302, 301)
    location = response.location.decode("utf-8")
    # For example, the app might redirect to "/group_preferences?answer=1"
    assert "group_preferences" in location and "answer=1" in location


def test_thank_you(client):
    """
    Test GET /thank_you route.
    """
    response = client.get("/thank_you")
    assert response.status_code == 200
    data = response.data.decode("utf-8")
    assert "Thank You Page" in data


def test_no_consent(client):
    """
    Test GET /no_consent route.
    """
    response = client.get("/no_consent")
    assert response.status_code == 200
    data = response.data.decode("utf-8")
    assert "No Consent Page" in data


def test_admin_no_session(client):
    """
    Test accessing the admin page without a session should redirect to login.
    """
    response = client.get("/admin")
    assert response.status_code in (302, 301)
    location = response.location.decode("utf-8")
    assert "login" in location


def test_admin_with_session(client):
    """
    Test accessing the admin page with a valid session should render the admin dashboard.
    """
    client.session["user_id"] = 123
    response = client.get("/admin")
    assert response.status_code == 200
    data = response.data.decode("utf-8")
    assert "Admin Dashboard" in data


def test_results(client, monkeypatch):
    """
    Test GET /results route.

    If the results page fetches data from the database and renders it using a template,
    this test simulates that behavior. We override render_template for 'results.html'.
    """
    # Monkey-patch render_template temporarily to simulate results output.
    original_render = client.application.render_template

    def results_render(template_name, **context):
        if template_name == "results.html":
            results = context.get("results", [])
            return f"Results: {results}"
        else:
            return original_render(template_name, **context)

    monkeypatch.setattr(client.application, "render_template", results_render)

    # For testing purposes, you might need to simulate the DB call.
    # Here we assume your route sets 'results' from DummyDBConnection.fetchall().
    response = client.get("/results")
    data = response.data.decode("utf-8")
    # Check that our dummy result (e.g., [("col1", "value1"), ("col2", "value2")]) is in the output.
    assert "col1" in data or "value1" in data


def test_download_csv(client):
    """
    Test GET /download-csv route.
    to check that the response contains proper CSV headers.
    """
    response = client.get("/download-csv")
    # Ensure the status code is OK (200)
    assert response.status_code == 200
    cd = response.headers.get("Content-Disposition", "")
    # Verify that the header includes 'attachment' which is typical for downloads.
    assert "attachment" in cd
    ct = response.headers.get("Content-Type", "")
    # Check that the content type is text/csv (or similar)
    assert "text/csv" in ct


def test_logout(client):
    """
    Test GET /logout route.
    here we simulate a logout which clears the session and redirects to login.
    """
    client.session["user_id"] = 123
    response = client.get("/logout")
    # Logout is usually implemented as a redirect (HTTP 302)
    assert response.status_code in (302, 301)
    location = response.location.decode("utf-8")
    assert "login" in location

def test_webhook_output(client):
    """
    Test the /mock_api_call endpoint to ensure it returns the correct JSON structure and status.
    """
    response = client.get("/mock_api_call")
    assert response.status_code == 200
    data = json.loads(response.data)
    # Check if the expected keys (message IDs) are present
    assert "success" in data
    # Check content of a specific message
    assert data["success"]== True

