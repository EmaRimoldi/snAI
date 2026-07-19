"""Runtime configuration: realdoor.config.json + environment overrides.

Precedence (highest wins):
1. Environment variables (REALDOOR_LLM_BACKUP=0, REALDOOR_LLM_LABELS=0,
   REALDOOR_LLM_COMPREHEND=0, REALDOOR_LLM_CMD, REALDOOR_CONFIG)
2. The JSON config file (REALDOOR_CONFIG path, else solution/realdoor.config.json)
3. Built-in defaults

llm.mode: "deterministic" (no model calls) | "labels" (anonymized label
classifier only) | "comprehend" (symbolized document reading only) |
"both" (default).
"""
from __future__ import annotations

import json
import os
from pathlib import Path

_DEFAULTS: dict = {
    "llm": {"mode": "both", "provider": "claude-cli", "model": "haiku",
            "command": None, "api_key_env": "ANTHROPIC_API_KEY",
            "timeout_seconds": 120},
    "ocr": {"dpi": 200, "binarize_threshold": 190, "min_confidence": 40,
            "tessdata_dir": ".tessdata"},
    "batch": {"max_workers": 8},
}


def _merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def _load() -> dict:
    path = os.environ.get("REALDOOR_CONFIG")
    candidate = (Path(path) if path
                 else Path(__file__).resolve().parents[1] / "realdoor.config.json")
    if candidate.exists():
        try:
            return _merge(_DEFAULTS, json.loads(candidate.read_text()))
        except (OSError, json.JSONDecodeError):
            pass
    return dict(_DEFAULTS)


def _load_dotenv() -> None:
    """Populate os.environ from the nearest .env up the tree (repo root).
    Existing environment variables always win; values never get logged."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if not candidate.exists():
            continue
        try:
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(),
                                      value.strip().strip('"').strip("'"))
        except OSError:
            pass
        break


_load_dotenv()
SETTINGS: dict = _load()


def llm_mode() -> str:
    """Effective mode after env overrides."""
    if os.environ.get("REALDOOR_LLM_BACKUP") == "0":
        return "deterministic"
    mode = SETTINGS["llm"].get("mode", "both")
    labels = os.environ.get("REALDOOR_LLM_LABELS")
    comprehend = os.environ.get("REALDOOR_LLM_COMPREHEND")
    has_labels = mode in ("labels", "both") and labels != "0"
    has_comp = mode in ("comprehend", "both") and comprehend != "0"
    if labels == "1":
        has_labels = True
    if comprehend == "1":
        has_comp = True
    if has_labels and has_comp:
        return "both"
    if has_labels:
        return "labels"
    if has_comp:
        return "comprehend"
    return "deterministic"


def llm_command() -> list[str]:
    import shlex
    override = os.environ.get("REALDOOR_LLM_CMD") or SETTINGS["llm"].get("command")
    if override:
        return shlex.split(override)
    return ["claude", "-p", "--model", SETTINGS["llm"].get("model", "haiku")]


def llm_timeout() -> int:
    return int(SETTINGS["llm"].get("timeout_seconds", 120))


def llm_provider() -> str:
    return SETTINGS["llm"].get("provider", "claude-cli")


def llm_model() -> str:
    return SETTINGS["llm"].get("model", "haiku")


def api_key() -> str | None:
    return os.environ.get(SETTINGS["llm"].get("api_key_env",
                                              "OPENAI_API_KEY"))


def ocr(key: str):
    return SETTINGS["ocr"][key]


def max_workers() -> int:
    return int(SETTINGS["batch"].get("max_workers", 8))


def summary() -> dict:
    """Echoed into CLI output so a backend can log the active config."""
    return {
        "llm_mode": llm_mode(),
        "llm_model": SETTINGS["llm"].get("model"),
        "llm_provider": SETTINGS["llm"].get("provider"),
        "ocr_dpi": SETTINGS["ocr"]["dpi"],
        "max_workers": max_workers(),
    }
