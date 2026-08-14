import os
import requests
import json
from dotenv import load_dotenv

load_dotenv("backend/.env")
api_key = os.environ.get("NVIDIA_API_KEY")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

payload = {
    "model": "thinkingmachines/inkling",
    "messages": [{"role": "user", "content": "Tell me a joke"}],
    "max_tokens": 100,
    "stream": True
}

try:
    response = requests.post("https://integrate.api.nvidia.com/v1/chat/completions", headers=headers, json=payload, stream=True)
    print(f"Status: {response.status_code}")
    for line in response.iter_lines():
        if line:
            print(line.decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
