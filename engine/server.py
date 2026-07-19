"""HTTP bridge between the Next.js frontend and the RealDoor engine.

Reference-stack shape: uvicorn on port 8787 (see CLAUDE.md §4b).

    cd engine
    .venv/bin/pip install -r requirements.txt
    .venv/bin/uvicorn server:app --port 8787

Endpoints:
    GET  /health   liveness + engine config summary
    POST /extract  multipart PDF uploads -> extraction artifact, the same
                   editable JSON `python -m realdoor.cli extract` emits
                   (documents + fields + boxes + confidence + source).

The frontend opts in with NEXT_PUBLIC_ENGINE=http://127.0.0.1:8787 — see
frontend/lib/engine/http.ts.  No document contents are logged or persisted:
uploads live in a TemporaryDirectory for the duration of the request only.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from realdoor import settings
from realdoor.cli import infer_document_type, refine_document_type
from realdoor.extract.batch import batch_extract

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://realdoor-boston.vercel.app",
]

app = FastAPI(title="RealDoor engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "engine": "realdoor", "config": settings.summary()}


@app.post("/extract")
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
            docs, stats = batch_extract(jobs)
        except Exception as exc:  # surface a clean error, never a traceback
            raise HTTPException(status_code=422, detail=f"extraction failed: {exc}") from exc
        # Types were inferred (no manifest on uploads) — refine from the
        # extracted fields, a much stronger signal than filename/keyword hints.
        for doc in docs:
            doc.document_type = refine_document_type(doc.document_type, doc.fields)

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
