FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm bubblewrap socat ripgrep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-install-project

COPY sandbox/package.json sandbox/package-lock.json sandbox/requirements.txt sandbox/
RUN npm ci --prefix sandbox \
    && uv venv sandbox/.venv \
    && uv pip install --python sandbox/.venv/bin/python -r sandbox/requirements.txt

COPY . .

EXPOSE 2024
CMD ["uv", "run", "langgraph", "dev", "--host", "0.0.0.0", "--port", "2024", "--no-browser", "--no-reload"]
