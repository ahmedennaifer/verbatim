"""Custom routes served by the LangGraph Agent Server (see langgraph.json)."""

from datetime import UTC, datetime
from pathlib import Path

from starlette.applications import Starlette
from starlette.exceptions import HTTPException
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Route

from agent.config import get_settings
from agent.tools.sql import connect

FILE_KINDS = {
    **dict.fromkeys((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"), "image"),
    ".pdf": "pdf",
    ".html": "html",
    ".htm": "html",
}
MAX_REVIEW_IDS = 50


def _outputs() -> Path:
    return (get_settings().workspace_dir / "outputs").resolve()


def output_file(request: Request) -> FileResponse:
    """Serve a file produced by the sandbox, and nothing outside workspace/outputs/."""
    outputs = _outputs()
    path = (outputs / request.path_params["path"]).resolve()
    if not path.is_relative_to(outputs) or not path.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(path)


def artifacts(request: Request) -> JSONResponse:
    """Every file the agent has produced, newest first."""
    outputs = _outputs()
    base_url = get_settings().api_public_url
    files = sorted((p for p in outputs.rglob("*") if p.is_file()), key=lambda p: p.stat().st_mtime, reverse=True)
    return JSONResponse(
        [
            {
                "name": p.name,
                "url": f"{base_url}/files/{p.relative_to(outputs).as_posix()}",
                "kind": FILE_KINDS.get(p.suffix.lower(), "download"),
                "size": p.stat().st_size,
                "created_at": datetime.fromtimestamp(p.stat().st_mtime, UTC).isoformat(),
            }
            for p in files
        ]
    )


REVIEWS_SQL = """
SELECT r.review_id, r.rating, r.title, left(r.body, 600), r.reviewed_at::date, r.verified_purchase,
       r.helpful_votes, p.title, b.name
FROM reviews r
JOIN products p USING (parent_asin)
LEFT JOIN brands b USING (brand_id)
WHERE r.review_id = ANY(%s)
"""


def reviews(request: Request) -> JSONResponse:
    """Look up cited reviews by id (?ids=1,2,3) so the UI can show them as sources."""
    raw = request.query_params.get("ids", "")
    ids = [int(i) for i in raw.split(",") if i.strip().isdigit()][:MAX_REVIEW_IDS]
    if not ids:
        return JSONResponse([])
    with connect() as conn:
        rows = conn.execute(REVIEWS_SQL, (ids,)).fetchall()
    return JSONResponse(
        [
            {
                "id": review_id,
                "rating": rating,
                "title": title,
                "body": body,
                "date": date.isoformat() if date else None,
                "verified": verified,
                "helpful_votes": helpful,
                "product": product,
                "brand": brand,
            }
            for review_id, rating, title, body, date, verified, helpful, product, brand in rows
        ]
    )


def info(request: Request) -> JSONResponse:
    """What the app runs on: the model and the dataset's size."""
    settings = get_settings()
    with connect() as conn:
        counts = dict(
            conn.execute(
                "SELECT relname, reltuples::bigint FROM pg_class WHERE relname IN ('reviews', 'products', 'brands')"
            ).fetchall()
        )
    return JSONResponse({"model": settings.llm_model, "provider": settings.llm_provider, "dataset": counts})


app = Starlette(
    routes=[
        Route("/files/{path:path}", output_file),
        Route("/artifacts", artifacts),
        Route("/reviews", reviews),
        Route("/info", info),
    ]
)
