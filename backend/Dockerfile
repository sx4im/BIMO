FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed for PyMuPDF, Pandas, and other C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Expose the port Gunicorn will listen on
EXPOSE 8000

# Start Gunicorn (matches previous Render start command)
CMD ["gunicorn", "-w", "2", "-k", "gthread", "--threads", "8", "--timeout", "600", "--bind", "0.0.0.0:8000", "app.main:app"]
