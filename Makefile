# One-shot local refresh: same as `python scripts/run_pipeline.py` from repo root.
# Prefer a venv: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
# then `make PYTHON=.venv/bin/python pipeline`

PYTHON ?= python3

.PHONY: pipeline pipeline-venv

pipeline:
	$(PYTHON) scripts/run_pipeline.py

pipeline-venv:
	@test -f .venv/bin/python || (echo "Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" && exit 1)
	.venv/bin/python scripts/run_pipeline.py
