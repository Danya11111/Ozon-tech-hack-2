# Vision classifier for Intel RealSense D415 on Orange PI (aarch64)
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
        libv4l-0 \
        v4l-utils \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Камера пробрасывается через docker-compose (--device)
CMD ["python", "main.py", "-c", "config.yaml"]
