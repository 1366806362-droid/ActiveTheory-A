#!/usr/bin/env python3
"""Lightweight regression tests for the Rapid Beauty Gate."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

from run_visual_gate import BLOCKED, GateConfigError, PROJECT_ROOT, run_gate, validate_config
from validate_visual_gate import ALLOWED, apply_review


RESULTS: list[dict[str, str]] = []


def test(name):
    def decorator(callback):
        try:
            callback()
            RESULTS.append({"name": name, "status": "pass"})
        except Exception as error:  # noqa: BLE001 - concise standalone test harness
            RESULTS.append({"name": name, "status": "fail", "message": str(error)})
        return callback
    return decorator


def make_workspace() -> tuple[tempfile.TemporaryDirectory, Path, dict]:
    holder = tempfile.TemporaryDirectory(prefix="visual-gate-test-")
    root = Path(holder.name)
    tool_dir = root / "tools/visual-gate"
    tool_dir.mkdir(parents=True)
    shutil.copy2(PROJECT_ROOT / "tools/visual-gate/mock_visual_experiment.py", tool_dir)
    config = {
        "schemaVersion": "1.0.0",
        "experimentId": "mock-success",
        "builder": "tools/visual-gate/mock_visual_experiment.py",
        "renderer": "tools/visual-gate/mock_visual_experiment.py",
        "builderArgs": [],
        "rendererArgs": [],
        "resolutionX": 128,
        "resolutionY": 72,
        "samples": 1,
        "beautyOnly": True,
        "denoise": True,
        "maxGateSeconds": 2,
        "outputDirectory": "art/visual-gate/mock-success",
        "outputFile": "BEAUTY_GATE.png",
        "allowFullProduction": False,
        "engine": "MOCK",
        "backend": "STANDARD_LIBRARY",
        "requiresBlender": False,
        "mockBehavior": "success",
        "mockDelaySeconds": 0,
    }
    return holder, root, config


def write_config(root: Path, config: dict) -> Path:
    path = root / "gate.json"
    path.write_text(json.dumps(config), encoding="utf-8")
    return path


@test("default Rapid Beauty config is valid")
def _():
    config = json.loads((PROJECT_ROOT / "tools/visual-gate/visual_gate_config.json").read_text(encoding="utf-8"))
    assert validate_config(config, PROJECT_ROOT) == []


@test("beauty-only mode is mandatory")
def _():
    holder, root, config = make_workspace()
    try:
        config["beautyOnly"] = False
        assert any("beautyOnly" in item for item in validate_config(config, root))
    finally:
        holder.cleanup()


@test("denoise is mandatory")
def _():
    holder, root, config = make_workspace()
    try:
        config["denoise"] = False
        assert any("denoise" in item for item in validate_config(config, root))
    finally:
        holder.cleanup()


@test("full production must be locked before review")
def _():
    holder, root, config = make_workspace()
    try:
        config["allowFullProduction"] = True
        assert any("allowFullProduction" in item for item in validate_config(config, root))
    finally:
        holder.cleanup()


@test("dry run validates without generating Beauty")
def _():
    holder, root, config = make_workspace()
    try:
        result = run_gate(write_config(root, config), dry_run=True, project_root=root)
        assert result["status"] == "DRY_RUN_PASS"
        assert result["productionStatus"] == BLOCKED
        assert not (root / result["outputPath"]).exists()
    finally:
        holder.cleanup()


@test("mock Beauty stops awaiting human review")
def _():
    holder, root, config = make_workspace()
    try:
        result = run_gate(write_config(root, config), project_root=root)
        assert result["status"] == "AWAITING_VISUAL_REVIEW"
        assert result["productionStatus"] == BLOCKED
        assert result["allowFullProduction"] is False
        assert (root / result["outputPath"]).read_bytes().startswith(b"\x89PNG")
    finally:
        holder.cleanup()


@test("mock timeout completes but blocks production")
def _():
    holder, root, config = make_workspace()
    try:
        config.update({"mockBehavior": "timeout", "mockDelaySeconds": 0.08, "maxGateSeconds": 0.04})
        result = run_gate(write_config(root, config), project_root=root)
        assert result["status"] == "GATE_TIMEOUT"
        assert result["timeout"] is True
        assert result["productionStatus"] == BLOCKED
        assert (root / result["outputPath"]).exists()
    finally:
        holder.cleanup()


@test("mock renderer error is reported and blocks production")
def _():
    holder, root, config = make_workspace()
    try:
        config["mockBehavior"] = "error"
        result = run_gate(write_config(root, config), project_root=root)
        assert result["status"] == "ERROR"
        assert result["errorStage"] == "renderer"
        assert result["productionStatus"] == BLOCKED
    finally:
        holder.cleanup()


@test("human PASS is the only operation that unlocks production")
def _():
    holder, root, config = make_workspace()
    try:
        result = run_gate(write_config(root, config), project_root=root)
        result_file = root / config["outputDirectory"] / "visual-gate-result.json"
        reviewed = apply_review(result_file, "PASS")
        assert result["allowFullProduction"] is False
        assert reviewed["status"] == "PASS"
        assert reviewed["allowFullProduction"] is True
        assert reviewed["productionStatus"] == ALLOWED
    finally:
        holder.cleanup()


@test("human NOT_READY keeps production blocked")
def _():
    holder, root, config = make_workspace()
    try:
        run_gate(write_config(root, config), project_root=root)
        result_file = root / config["outputDirectory"] / "visual-gate-result.json"
        reviewed = apply_review(result_file, "NOT_READY")
        assert reviewed["status"] == "NOT_READY"
        assert reviewed["productionStatus"] == BLOCKED
    finally:
        holder.cleanup()


@test("timeout cannot be converted into PASS")
def _():
    holder, root, config = make_workspace()
    try:
        config.update({"mockDelaySeconds": 0.06, "maxGateSeconds": 0.03})
        run_gate(write_config(root, config), project_root=root)
        result_file = root / config["outputDirectory"] / "visual-gate-result.json"
        try:
            apply_review(result_file, "PASS")
        except GateConfigError as error:
            assert BLOCKED in str(error)
        else:
            raise AssertionError("Timeout was incorrectly approved.")
    finally:
        holder.cleanup()


@test("output traversal outside art/visual-gate is rejected")
def _():
    holder, root, config = make_workspace()
    try:
        config["outputDirectory"] = "../outside"
        assert any("art/visual-gate" in item for item in validate_config(config, root))
    finally:
        holder.cleanup()


@test("disguised traversal inside the visual-gate prefix is rejected")
def _():
    holder, root, config = make_workspace()
    try:
        config["outputDirectory"] = "art/visual-gate/mock-success/../../outside"
        assert any("outputDirectory" in item for item in validate_config(config, root))
    finally:
        holder.cleanup()


@test("missing renderer is rejected before execution")
def _():
    holder, root, config = make_workspace()
    try:
        config["renderer"] = "tools/visual-gate/missing.py"
        assert any("renderer does not exist" in item for item in validate_config(config, root))
    finally:
        holder.cleanup()


failed = [result for result in RESULTS if result["status"] == "fail"]
print(json.dumps({"passed": len(RESULTS) - len(failed), "failed": len(failed), "results": RESULTS}, indent=2))
raise SystemExit(1 if failed else 0)
