"""Modal serverless deployment for BMO backend."""

from pathlib import Path
import modal

backend_dir = Path(__file__).resolve().parent

app = modal.App("bmo-backend")

# Define the container image matching backend/Dockerfile
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("build-essential", "libpq-dev")
    .pip_install_from_requirements(str(backend_dir / "requirements.txt"))
    .add_local_python_source("app")
)

# Use the named Secret from Modal dashboard
secrets = [modal.Secret.from_name("bmo-secrets")]


@app.function(
    image=image,
    cpu=2.0,  # 2 dedicated vCPUs
    memory=4096,  # 4 GB RAM (8x Render free!)
    secrets=secrets,
    timeout=600,
    scaledown_window=300,  # Stays warm for 5 minutes after last request
)
@modal.wsgi_app()
def flask_app():
    from app.main import create_app

    return create_app()
