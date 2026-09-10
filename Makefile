# Developer entry points. Run `make` or `make help` for the list.

SHELL := /bin/bash
.DEFAULT_GOAL := help

PY      ?= .venv/bin/python
VENV    := .venv
FRONT   := frontend
EXT     := vscode
TARGET  ?= http://127.0.0.1:2024
PORT    ?= 8100

.PHONY: help setup setup-py setup-front setup-ext build build-front build-ext package \
        dev proxy check check-py check-front check-ext test lint format clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- setup

setup: setup-py setup-front setup-ext ## Install everything (Python venv, frontend, extension)

setup-py: ## Create .venv and install the package with dev + proxy extras
	test -d $(VENV) || uv venv $(VENV)
	uv pip install --python $(PY) -e ".[dev,proxy]"

setup-front: ## Install frontend dependencies
	cd $(FRONT) && pnpm install

setup-ext: ## Install VS Code extension dependencies
	cd $(EXT) && pnpm install

# ---------------------------------------------------------------- build

build: build-front build-ext ## Build the UI (into the Python package and vscode/media) and the extension

build-front: ## Build the UI; output goes to src/langgraph_studio_oss/static and vscode/media
	cd $(FRONT) && pnpm build

build-ext: ## Compile the VS Code extension (requires build-front for the UI)
	cd $(EXT) && pnpm build

package: build ## Produce the .vsix and the Python wheel
	cd $(EXT) && pnpm package
	uv build --wheel

# ---------------------------------------------------------------- run

dev: ## Frontend dev server on :5173 with API proxied to $(TARGET)
	cd $(FRONT) && pnpm dev

proxy: ## Standalone proxy mode: UI on :$(PORT), Agent Server at $(TARGET)
	$(PY) -m langgraph_studio_oss.cli --target $(TARGET) --port $(PORT)

# ---------------------------------------------------------------- checks

check: check-py check-front check-ext ## Run every check

check-py: ## ruff + pytest
	$(PY) -m ruff check src tests
	$(PY) -m ruff format --check src tests
	$(PY) -m pytest

check-front: ## typecheck + eslint + prettier + vitest
	cd $(FRONT) && pnpm check

check-ext: ## Extension typecheck + vitest
	cd $(EXT) && pnpm check

test: ## Tests only (pytest + vitest for both packages)
	$(PY) -m pytest
	cd $(FRONT) && pnpm test
	cd $(EXT) && pnpm test

lint: ## Linters only
	$(PY) -m ruff check src tests
	cd $(FRONT) && pnpm lint

format: ## Auto-format Python and frontend sources
	$(PY) -m ruff format src tests
	cd $(FRONT) && pnpm format

# ---------------------------------------------------------------- misc

clean: ## Remove build artifacts (keeps node_modules and .venv)
	rm -rf src/langgraph_studio_oss/static $(EXT)/media $(EXT)/out $(EXT)/*.vsix dist build \
	       $(FRONT)/dist $(FRONT)/*.tsbuildinfo .pytest_cache .ruff_cache
