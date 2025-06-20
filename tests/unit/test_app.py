import json

def test_get_all_data(client):
    """
    Test the /api/data endpoint to ensure it returns the correct JSON structure and status.
    """
    response = client.get("/api/data")
    assert response.status_code == 200
    data = json.loads(response.data)
    # Check if the expected keys (message IDs) are present
    assert "1" in data
    assert "2" in data
    # Check content of a specific message
    assert data["1"]["text"] == "Hello from the backend!"
    assert data["1"]["author"] == "System"
