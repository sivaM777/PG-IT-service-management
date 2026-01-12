FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.2.2
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ARG AI_LOCAL_HF_MODEL=typeform/distilbert-base-uncased-mnli
ENV HF_HOME=/app/hf-cache
ENV TRANSFORMERS_CACHE=/app/hf-cache
RUN python -c "from transformers import pipeline; pipeline('zero-shot-classification', model='${AI_LOCAL_HF_MODEL}')"
RUN python train.py --data data/train.jsonl --out-dir model
EXPOSE 8001
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
