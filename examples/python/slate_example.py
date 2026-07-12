import os
import uuid
import requests

base_url = os.environ["SLATE_BASE_URL"].rstrip("/")
api_key = os.environ["SLATE_API_KEY"]

response = requests.post(
    f"{base_url}/api/v1/ai/gateway",
    headers={"Authorization": f"Bearer {api_key}"},
    json={
        "employeeExternalId": "employee-427",
        "clientExternalId": "client-acme",
        "projectExternalId": "project-seo-001",
        "workflowExternalId": "client-update",
        "taskType": "client_update",
        "sourceAppRequestId": str(uuid.uuid4()),
        "model": "gpt-4o-mini",
        "input": "Draft a brief client update.",
    },
    timeout=35,
)
response.raise_for_status()
print(response.json()["response"])
