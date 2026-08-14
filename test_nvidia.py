import os
import requests
from dotenv import load_dotenv

load_dotenv("backend/.env")
api_key = os.environ.get("NVIDIA_API_KEY")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "model": "thinkingmachines/inkling",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100,
    "stream": False
}

try:
    response = requests.post("https://integrate.api.nvidia.com/v1/chat/completions", headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
