"""Batch extraction: parallel tokenization + at most ONE LLM call per batch.

    Phase 1  tokenize all PDFs in parallel worker processes (pdfplumber /
             OCR -- the only expensive I/O)
    Phase 2  deterministic scored matching in the parent (~0.5 ms/doc)
    Phase 3  ONE batched anonymized label-classifier call, covering only
             label boxes the cascade could not classify, and only for
             documents that still miss expected fields.  Cache-aware:
             zero calls when there is nothing to ask.
    Phase 4  local re-match with the classifier's answers, assemble records

Matching stays in the parent so seen/used state remains valid across the
classifier re-run.  Returns (documents, stats) with per-phase timings.
"""
from __future__ import annotations

import os
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

from . import llm_backup
from .normalize import MatchState, _build_record, tokenize_document


@dataclass
class BatchStats:
    documents: int = 0
    tokenize_seconds: float = 0.0
    match_seconds: float = 0.0
    llm_seconds: float = 0.0
    llm_calls: int = 0
    llm_labels_sent: int = 0
    workers: int = 1
    extra: dict = field(default_factory=dict)


def _tokenize_job(args):
    """Worker-process entry: expensive I/O only, results pickle cleanly."""
    pdf_path, *_rest = args
    return tokenize_document(pdf_path)


def batch_extract(
    jobs: list[tuple],
    max_workers: int | None = None,
):
    """jobs: (pdf_path, document_id, household_id, document_type, file_name).

    Returns (list[DocumentRecord] in job order, BatchStats).
    """
    from .. import settings
    stats = BatchStats(documents=len(jobs))
    if max_workers is None:
        max_workers = max(1, min(settings.max_workers(),
                                 (os.cpu_count() or 2) - 1))
    stats.workers = max_workers

    # Phase 1: parallel tokenization.
    start = time.perf_counter()
    if len(jobs) > 1 and max_workers > 1:
        with ProcessPoolExecutor(max_workers=max_workers) as pool:
            tokenized = list(pool.map(_tokenize_job, jobs))
    else:
        tokenized = [_tokenize_job(job) for job in jobs]
    stats.tokenize_seconds = time.perf_counter() - start

    # Phase 2: deterministic matching (parent process).
    start = time.perf_counter()
    states: list[MatchState] = []
    for (pdf_path, doc_id, hh_id, doc_type, file_name), \
            (token_pages, page_size, rasterized) in zip(jobs, tokenized):
        state = MatchState(token_pages, doc_type)
        state.run_deterministic()
        states.append(state)
    stats.match_seconds = time.perf_counter() - start

    # Phase 3: one batched classifier call for the whole batch, at most.
    # Only labels the cascade could not classify, and only for documents
    # that still miss expected fields (e.g. no gross amount yet).
    start = time.perf_counter()
    overrides_by_index: dict[int, dict[str, str]] = {}
    if llm_backup.labels_enabled():
        asks: dict[str, list[str]] = {}
        needing: list[tuple[int, dict[str, str]]] = []
        for index, state in enumerate(states):
            if not state.missing_expected():
                continue
            unknown = state.unknown_labels()
            if not unknown:
                continue
            needing.append((index, unknown))
            asks.setdefault(jobs[index][3], []).extend(unknown.values())
        if needing:
            mapping, calls, labels_sent = llm_backup.classify_labels_batch(asks)
            stats.llm_calls = calls
            stats.llm_labels_sent = labels_sent
            for index, unknown in needing:
                doc_type = jobs[index][3]
                overrides_by_index[index] = {
                    key: mapping[(doc_type, text)]
                    for key, text in unknown.items()
                    if (doc_type, text) in mapping}
    # Phase 3b: ONE batched comprehension call for documents whose core
    # fields are still missing after the classifier round -- the LLM reads
    # symbol-anonymized text and names positions, never values.
    if llm_backup.comprehension_enabled():
        for index in overrides_by_index:
            states[index].apply_overrides(overrides_by_index[index])
            overrides_by_index[index] = {}
        requests, symtabs = [], {}
        for index, state in enumerate(states):
            if not llm_backup.recoverable_missing(jobs[index][3],
                                                  state.missing_expected()):
                continue
            key = f"DOC{index}"
            text, symtab = state.symbolize()
            requests.append((key, jobs[index][3], text))
            symtabs[key] = (index, symtab)
        if requests:
            answers, calls = llm_backup.comprehend_documents(requests)
            stats.llm_calls += calls
            for key, (index, symtab) in symtabs.items():
                states[index].fill_from_comprehension(
                    answers.get(key, {}), symtab)
    stats.llm_seconds = time.perf_counter() - start

    # Phase 4: apply classifier answers locally + finalize all records.
    start = time.perf_counter()
    docs = []
    for index, ((pdf_path, doc_id, hh_id, doc_type, file_name),
                (token_pages, page_size, rasterized)) in enumerate(
                    zip(jobs, tokenized)):
        state = states[index]
        if index in overrides_by_index:
            state.apply_overrides(overrides_by_index[index])
        fields = state.finalize()
        docs.append(_build_record(pdf_path, doc_id, hh_id, doc_type,
                                  file_name, fields, page_size, rasterized))
    stats.match_seconds += time.perf_counter() - start
    return docs, stats
