import requests
import json

def send_post_request(url: str, data_string: str):
    """
    Sends an HTTP POST request to the specified URL with a JSON payload.

    The JSON payload will have a single key "data" with the value of data_string.

    Args:
        url (str): The URL to send the POST request to.
        data_string (str): The string data to include in the JSON payload.

    Returns:
        requests.Response or None: The Response object from the server if the
                                     request was successful, None otherwise.
                                     You can access the status code, headers,
                                     and JSON response content from this object
                                     (e.g., response.status_code, response.json()).
    """
    payload = {"data": data_string}
    headers = {"Content-Type": "application/json"}

    print(f"Sending POST request to: {url}")
    # print(f"Payload: {json.dumps(payload)}")

    try:
        # Make the POST request
        response = requests.post(url, json=payload, headers=headers, timeout=10) # 10-second timeout

        # Raise an HTTPError for bad responses (4XX or 5XX)
        response.raise_for_status()

        print(f"Response status code: {response.status_code}")
        try:
            print(f"Response JSON: {response.json()}")
        except json.JSONDecodeError:
            print(f"Response content (not JSON): {response.text}")

        return response

    except requests.exceptions.HTTPError as http_err:
        # Handle HTTP errors (e.g., 404, 500)
        print(f"HTTP error occurred: {http_err}")
        print(f"Response content: {response.content if 'response' in locals() else 'N/A'}")
    except requests.exceptions.ConnectionError as conn_err:
        # Handle connection errors (e.g., DNS failure, refused connection)
        print(f"Connection error occurred: {conn_err}")
    except requests.exceptions.Timeout as timeout_err:
        # Handle timeout errors
        print(f"Timeout error occurred: {timeout_err}")
    except requests.exceptions.RequestException as req_err:
        # Handle other types of request exceptions
        print(f"An error occurred during the request: {req_err}")
    except Exception as e:
        # Catch any other unexpected errors
        print(f"An unexpected error occurred: {e}")

    return None