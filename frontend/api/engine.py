"""RealDoor engine as a Vercel Python serverless function.

Mirrors engine/server.py for the deployed site (official Next.js + FastAPI
hybrid pattern). The engine package is copied into api/_engine/ by
frontend/deploy.sh at deploy time (gitignored — engine/ stays the single
source of truth). Vector PDFs parse fully; rasterized PDFs need tesseract,
which serverless lacks, so they fail with an honest 422 (abstention).

Routes carry the full /api/engine/... path because vercel.json rewrites
/api/engine/:path* to this single function.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "_engine"))

from fastapi import FastAPI, File, HTTPException, UploadFile  # noqa: E402

from realdoor import settings  # noqa: E402
from realdoor.cli import infer_document_type  # noqa: E402
from realdoor.extract.batch import batch_extract  # noqa: E402

app = FastAPI(title="RealDoor engine (serverless)")


@app.get("/api/engine/health")
def health() -> dict:
    return {"ok": True, "engine": "realdoor", "runtime": "vercel-python",
            "config": settings.summary()}


@app.post("/api/engine/extract")
async def extract(files: list[UploadFile] = File(...)) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="no files uploaded")

    household_id = "HH-SESSION"
    with tempfile.TemporaryDirectory(prefix="realdoor-upload-") as tmp:
        jobs: list[tuple] = []
        for index, upload in enumerate(files, start=1):
            name = Path(upload.filename or f"document-{index}.pdf").name
            path = Path(tmp) / f"{index:02d}-{name}"
            path.write_bytes(await upload.read())
            jobs.append(
                (
                    path,
                    f"{household_id}-D{index:02d}",
                    household_id,
                    infer_document_type(path),
                    name,
                )
            )
        try:
            # max_workers=1 keeps extraction serial — no ProcessPoolExecutor
            # inside the serverless sandbox.
            docs, stats = batch_extract(jobs, max_workers=1)
        except Exception as exc:  # surface a clean error, never a traceback
            raise HTTPException(status_code=422, detail=f"extraction failed: {exc}") from exc

    return {
        "artifact": "realdoor.extraction",
        "config": settings.summary(),
        "stats": {
            "documents": stats.documents,
            "tokenize_seconds": round(stats.tokenize_seconds, 3),
            "match_seconds": round(stats.match_seconds, 3),
            "llm_seconds": round(stats.llm_seconds, 3),
            "llm_calls": stats.llm_calls,
            "workers": stats.workers,
        },
        "documents": [doc.to_dict() for doc in docs],
    }
