FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY apps/api/pyproject.toml ./pyproject.toml
COPY apps/api/givehub ./givehub
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/alembic ./alembic

CMD ["fastapi", "run", "givehub/main.py", "--host", "0.0.0.0", "--port", "8000"]
