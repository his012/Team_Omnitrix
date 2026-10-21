FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py .
EXPOSE 80
CMD ["gunicorn", "-b", "0.0.0.0:80", "-w", "2", "--threads", "4", "server:app"]
