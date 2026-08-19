#!/usr/bin/env python3
"""Validate a gate config or apply an explicit human Beauty review decision."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from run_visual_gate import BLOCKED, GateConfigError, PROJECT_ROOT, load_config, validate_config


ALLOWED = "FULL_PRODUCTION_ALLOWED"


def apply_review(result_file: Path, decision: str) -> dict:
    result = json.loads(result_file.read_text(encoding="utf-8"))
    if result.get("status") != "AWAITING_VISUAL_REVIEW":
        raise GateConfigError(
            f"Review cannot change status {result.get('status')}; {BLOCKED}."
        )

    if decision == "PASS":
        result.update({
            "status": "PASS",
            "visualReviewRequired": False,
            "allowFullProduction": True,
            "productionStatus": ALLOWED,
            "reviewDecision": "PASS",
        })
    else:
        result.update({
            "status": "NOT_READY",
            "visualReviewRequired": False,
            "allowFullProduction": False,
            "productionStatus": BLOCKED,
            "reviewDecision": "NOT_READY",
        })
    result_file.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--config", type=Path)
    group.add_argument("--result-file", type=Path)
    parser.add_argument("--result", choices=("PASS", "NOT_READY"))
    args = parser.parse_args()

    try:
        if args.config:
            config = load_config(args.config.resolve())
            errors = validate_config(config, PROJECT_ROOT)
            if errors:
                raise GateConfigError("\n".join(errors))
            output = {"status": "CONFIG_VALID", "productionStatus": BLOCKED}
        else:
            if not args.result:
                raise GateConfigError("--result PASS or --result NOT_READY is required for a result file.")
            output = apply_review(args.result_file.resolve(), args.result)
    except (GateConfigError, OSError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "ERROR", "message": str(error)}, ensure_ascii=False, indent=2))
        return 2

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
