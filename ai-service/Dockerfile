# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Set work directory
WORKDIR /app

# Install system dependencies (for spaCy and Edge-TTS)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libssl-dev \
    libffi-dev \
    gcc \
    && rm -rf /var/lib/apt/lib/lists/*

# Install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn uvicorn

# Download spaCy model
RUN python -m spacy download en_core_web_sm

# Copy project files
COPY . .

# Create directory for audio storage
RUN mkdir -p temp_audio && chmod 777 temp_audio

# Expose the port
EXPOSE 8080

# Command to run the application
# We use gunicorn with uvicorn workers for production
CMD gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT
