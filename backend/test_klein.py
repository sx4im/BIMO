import os
import requests
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("NVIDIA_API_KEY")
url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b"

body = {
    "prompt": "Make it red",
    "seed": 42,
    "steps": 4,
    "width": 1024,
    "height": 1024,
    "image": "data:image/png;asset_id,12345"
}

resp = requests.post(
    url,
    headers={
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    },
    json=body
)

print(resp.status_code)
print(resp.text[:500])
