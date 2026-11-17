FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    nodejs npm curl git && \
    npm install -g aws-cdk aws-cdk-local && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Apuntar al emulador (LocalStack o MiniStack)
ENV AWS_ACCESS_KEY_ID=test
ENV AWS_SECRET_ACCESS_KEY=test
ENV AWS_DEFAULT_REGION=us-east-1
ENV PYTHONPATH=/app:/app/lambdas/api

CMD ["bash"]
