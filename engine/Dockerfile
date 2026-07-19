# RealDoor engine — full-OCR image (poppler + tesseract included).
# Without these system binaries the engine still runs, but rasterized PDFs
# abstain per field (renter types the values). This image enables real OCR.
#
#   docker build -t realdoor-engine engine/
#   docker run -p 8787:8787 realdoor-engine
#
# CORS: server.py allows localhost:3000 and realdoor-boston.vercel.app.
FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY realdoor ./realdoor
COPY server.py realdoor.config.json ./

# No document contents are ever written to disk outside the request lifetime;
# uploads land in a tmpdir that is deleted per request (see server.py).
EXPOSE 8787
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8787"]
