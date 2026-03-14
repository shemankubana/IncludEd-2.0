# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

# Set work directory
WORKDIR /app

# Install system dependencies (for spaCy and Edge-TTS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (avoids downloading 2GB GPU build)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn uvicorn && \
    pip cache purge && \
    find /usr/local/lib/python3.12 -name "*.pyc" -delete && \
    find /usr/local/lib/python3.12 -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# Download spaCy model (pinned to match spacy==3.7.2)
RUN pip install --no-cache-dir https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.7.2/en_core_web_sm-3.7.2-py3-none-any.whl

# Copy project files
COPY . .

# Create directory for audio storage
RUN mkdir -p temp_audio && chmod 777 temp_audio

# Expose the port
EXPOSE 7860

# Command to run the application
# We use gunicorn with uvicorn workers for production
CMD gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT --timeout 120
