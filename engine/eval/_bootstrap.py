"""Puts solution/ on sys.path so eval scripts can import realdoor."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
