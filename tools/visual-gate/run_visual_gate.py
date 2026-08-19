#!/usr/bin/env python3
"""Run one isolated, beauty-only visual experiment and stop for human review."""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = Path(__file__).with_name("visual_gate_config.json")
ALLOWED_OUTPUT_ROOT = Path("art/visual-gate")
MAX_RESOLUTION = (1280, 720)
MAX_SAMPLES = 16
MAX_GATE_SECONDS = 300
BLOCKED = "FULL_PRODUCTION_BLOCKED"


class GateConfigError(ValueError):
    """Raised when a gate config violates the rapid-review safety contract."""


def load_config(config_path: Path) -> dict[str, Any]:
    with config_path.open("r", encoding="utf-8") as handle:
        config = json.load(handle)
    if not isinstance(config, dict):
        raise GateConfigError("Config root must be a JSON object.")
    return config


def validate_config(config: dict[str, Any], project_root: Path = PROJECT_ROOT) -> list[str]:
    errors: list[str] = []
    required = (
        "experimentId",
        "builder",
        "renderer",
        "resolutionX",
        "resolutionY",
        "samples",
        "beautyOnly",
        "denoise",
        "maxGateSeconds",
        "outputDirectory",
        "outputFile",
        "allowFullProduction",
    )
    for key in required:
        if key not in config:
            errors.append(f"Missing required field: {key}")

    experiment_id = config.get("experimentId")
    if not isinstance(experiment_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{1,63}", experiment_id):
        errors.append("experimentId must be 2-64 lowercase URL-safe characters.")

    for key in ("builder", "renderer"):
        value = config.get(key)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{key} must be a project-relative file path.")
            continue
        resolved = _safe_project_path(value, project_root)
        if resolved is None:
            errors.append(f"{key} must remain inside the project root.")
        elif not resolved.is_file():
            errors.append(f"{key} does not exist: {value}")

    resolution_x = config.get("resolutionX")
    resolution_y = config.get("resolutionY")
    if not _is_positive_int(resolution_x) or resolution_x > MAX_RESOLUTION[0]:
        errors.append(f"resolutionX must be between 1 and {MAX_RESOLUTION[0]}.")
    if not _is_positive_int(resolution_y) or resolution_y > MAX_RESOLUTION[1]:
        errors.append(f"resolutionY must be between 1 and {MAX_RESOLUTION[1]}.")

    samples = config.get("samples")
    if not _is_positive_int(samples) or samples > MAX_SAMPLES:
        errors.append(f"samples must be between 1 and {MAX_SAMPLES}.")
    if config.get("beautyOnly") is not True:
        errors.append("beautyOnly must be true; auxiliary passes are forbidden at the gate.")
    if config.get("denoise") is not True:
        errors.append("denoise must be true for the Rapid Beauty Gate.")
    if config.get("allowFullProduction") is not False:
        errors.append("allowFullProduction must be false before human Beauty PASS.")

    max_seconds = config.get("maxGateSeconds")
    if not _is_positive_number(max_seconds) or max_seconds > MAX_GATE_SECONDS:
        errors.append(f"maxGateSeconds must be greater than 0 and at most {MAX_GATE_SECONDS}.")

    output_directory = config.get("outputDirectory")
    if not isinstance(output_directory, str) or not output_directory:
        errors.append("outputDirectory must be a project-relative path.")
    else:
        resolved_output = _safe_project_path(output_directory, project_root)
        expected_output = (
            project_root / ALLOWED_OUTPUT_ROOT / str(experiment_id)
        ).resolve() if isinstance(experiment_id, str) else None
        if resolved_output is None or expected_output is None or resolved_output != expected_output:
            errors.append("outputDirectory must equal art/visual-gate/<experimentId>.")

    if config.get("outputFile") != "BEAUTY_GATE.png":
        errors.append("outputFile must be BEAUTY_GATE.png.")

    for key in ("builderArgs", "rendererArgs"):
        value = config.get(key, [])
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            errors.append(f"{key} must be an array of strings.")

    if config.get("requiresBlender", False):
        blender_value = config.get("blenderExecutable")
        if not isinstance(blender_value, str) or not blender_value:
            errors.append("blenderExecutable is required when requiresBlender is true.")
        elif not Path(blender_value).expanduser().is_file():
            errors.append(f"Blender executable not found: {blender_value}")

    for key in ("engine", "backend"):
        if not isinstance(config.get(key, "UNKNOWN"), str):
            errors.append(f"{key} must be a string when provided.")

    return errors


def run_gate(
    config_path: Path,
    *,
    dry_run: bool = False,
    project_root: Path = PROJECT_ROOT,
) -> dict[str, Any]:
    started = time.perf_counter()
    config_path = config_path.resolve()
    config = load_config(config_path)
    errors = validate_config(config, project_root)
    if errors:
        raise GateConfigError("\n".join(errors))

    output_directory = (project_root / config["outputDirectory"]).resolve()
    output_directory.mkdir(parents=True, exist_ok=True)
    output_file = output_directory / config["outputFile"]
    result_file = output_directory / "visual-gate-result.json"
    log_file = output_directory / "visual-gate.log"
    log_lines = [
        f"experiment={config['experimentId']}",
        f"mode={'dry-run' if dry_run else 'beauty-only'}",
        f"budgetSeconds={config['maxGateSeconds']}",
        f"production={BLOCKED}",
    ]

    base_result = {
        "schemaVersion": "1.0.0",
        "experimentId": config["experimentId"],
        "status": "DRY_RUN_PASS" if dry_run else "PENDING",
        "resolution": [config["resolutionX"], config["resolutionY"]],
        "samples": config["samples"],
        "beautyOnly": True,
        "denoise": True,
        "engine": config.get("engine", "UNKNOWN"),
        "backend": config.get("backend", "UNKNOWN"),
        "buildSeconds": 0.0,
        "renderSeconds": 0.0,
        "totalSeconds": 0.0,
        "maxGateSeconds": config["maxGateSeconds"],
        "outputPath": _relative_posix(output_file, project_root),
        "timeout": False,
        "allowFullProduction": False,
        "productionStatus": BLOCKED,
        "visualReviewRequired": not dry_run,
    }

    if dry_run:
        base_result["totalSeconds"] = _elapsed(started)
        _write_result(result_file, base_result)
        _write_log(log_file, log_lines + ["status=DRY_RUN_PASS"])
        return base_result

    build_started = time.perf_counter()
    builder = _run_stage("builder", config, config_path, output_directory, project_root)
    base_result["buildSeconds"] = _elapsed(build_started)
    log_lines.append(f"builderExitCode={builder.returncode}")

    if builder.returncode != 0:
        result = _finish_error(base_result, started, "builder", builder)
        _write_result(result_file, result)
        _write_log(log_file, log_lines + ["status=ERROR", "production=FULL_PRODUCTION_BLOCKED"])
        return result

    render_started = time.perf_counter()
    renderer = _run_stage("renderer", config, config_path, output_directory, project_root)
    base_result["renderSeconds"] = _elapsed(render_started)
    base_result["totalSeconds"] = _elapsed(started)
    log_lines.append(f"rendererExitCode={renderer.returncode}")

    if renderer.returncode != 0:
        result = _finish_error(base_result, started, "renderer", renderer)
    elif not output_file.is_file():
        result = dict(base_result)
        result.update({
            "status": "ERROR",
            "errorStage": "renderer",
            "errorMessage": "Renderer completed without BEAUTY_GATE.png.",
        })
    elif base_result["totalSeconds"] > config["maxGateSeconds"]:
        result = dict(base_result)
        result.update({"status": "GATE_TIMEOUT", "timeout": True})
    else:
        result = dict(base_result)
        result["status"] = "AWAITING_VISUAL_REVIEW"

    _write_result(result_file, result)
    _write_log(log_file, log_lines + [f"status={result['status']}", "production=FULL_PRODUCTION_BLOCKED"])
    return result


def _run_stage(
    stage: str,
    config: dict[str, Any],
    config_path: Path,
    output_directory: Path,
    project_root: Path,
) -> subprocess.CompletedProcess[str]:
    key = "builder" if stage == "builder" else "renderer"
    args_key = "builderArgs" if stage == "builder" else "rendererArgs"
    script = (project_root / config[key]).resolve()
    template_values = {
        "config": str(config_path),
        "outputDirectory": str(output_directory),
        "outputFile": str(output_directory / config["outputFile"]),
        "resolutionX": str(config["resolutionX"]),
        "resolutionY": str(config["resolutionY"]),
        "samples": str(config["samples"]),
    }
    configured_args = config.get(args_key, [])
    if configured_args:
        stage_args = [item.format(**template_values) for item in configured_args]
    else:
        stage_args = [
            "--visual-gate-stage",
            "build" if stage == "builder" else "render",
            "--config",
            str(config_path),
            "--output-directory",
            str(output_directory),
        ]

    command = _command_for_script(script) + stage_args
    return subprocess.run(
        command,
        cwd=project_root,
        capture_output=True,
        text=True,
        check=False,
    )


def _command_for_script(script: Path) -> list[str]:
    suffix = script.suffix.lower()
    if suffix == ".py":
        return [sys.executable, str(script)]
    if suffix == ".ps1":
        return ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)]
    return [str(script)]


def _finish_error(
    base_result: dict[str, Any],
    started: float,
    stage: str,
    completed: subprocess.CompletedProcess[str],
) -> dict[str, Any]:
    result = dict(base_result)
    result.update({
        "status": "ERROR",
        "totalSeconds": _elapsed(started),
        "errorStage": stage,
        "errorMessage": (completed.stderr or completed.stdout or "Unknown process failure").strip()[-500:],
    })
    return result


def _safe_project_path(value: str, project_root: Path) -> Path | None:
    candidate = Path(value)
    if candidate.is_absolute():
        return None
    resolved = (project_root / candidate).resolve()
    return resolved if _is_relative_to(resolved, project_root.resolve()) else None


def _is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def _is_positive_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _is_positive_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def _elapsed(started: float) -> float:
    return round(time.perf_counter() - started, 4)


def _relative_posix(path: Path, project_root: Path) -> str:
    return path.resolve().relative_to(project_root.resolve()).as_posix()


def _write_result(path: Path, result: dict[str, Any]) -> None:
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _write_log(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        result = run_gate(args.config, dry_run=args.dry_run)
    except (GateConfigError, OSError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "ERROR", "message": str(error)}, ensure_ascii=False, indent=2))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] != "ERROR" else 1


if __name__ == "__main__":
    raise SystemExit(main())
