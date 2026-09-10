"""Shared fixtures: the UI build is not part of the repository, so tests serve a stub page."""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest

# The package re-exports the Starlette `app` object, so import the module explicitly
app_module = importlib.import_module("langgraph_studio_oss.app")


@pytest.fixture(autouse=True)
def stub_static(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the package at a temporary static dir with a minimal index.html."""
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<!doctype html><title>Studio</title>", "utf-8")
    monkeypatch.setattr(app_module, "STATIC_DIR", static)
    return static
