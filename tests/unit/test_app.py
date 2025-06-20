import json

def test_webhook_output(client):
    """
    Test the /mock_api_call endpoint to ensure it returns the correct JSON structure and status.
    """
    response = client.get("/mock_api_call")
    assert response.status_code == 200
    data = json.loads(response.data)
    # Check content of a specific message
    assert data == "success"
