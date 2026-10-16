FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_PYTHON_DOWNLOADS=never
ENV PATH="/app/.venv/bin:$PATH"
WORKDIR /app

COPY apps/api/pyproject.toml ./pyproject.toml
COPY apps/api/uv.lock ./uv.lock
COPY apps/api/givehub ./givehub
RUN pip install --no-cache-dir uv==0.12.23 && uv sync --locked --no-dev
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/alembic ./alembic

CMD ["fastapi", "run", "givehub/main.py", "--host", "0.0.0.0", "--port", "8000"]
