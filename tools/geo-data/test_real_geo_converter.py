"""Lightweight deterministic verification for the 2026-07-29 real GEO converter."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import tempfile
import zipfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONVERTER_PATH = Path(__file__).with_name("convert_real_geo_dataset.py")
MAPPING_PATH = Path(__file__).with_name("geo_real_data_mapping_20260729.json")
ARTIFACT_PATH = ROOT / "art" / "geo-dashboard" / "v16-real-data-20260729" / "deterministic-output-check.json"
RULE_TABLE = Path.home() / "Desktop" / "发票" / "GEO_Codex分析规则总表_V1.md"
RULE_CHANGELOG = Path.home() / "Desktop" / "发票" / "GEO_Codex规则变更日志_V1.md"
SOURCE_NAMES = {
    "geo_zip": "7-29_GEO_Module_Pack (2).zip",
    "a5_zip": "7-29_5A+品牌心智清洗结果 (1).zip",
    "fusion_zip": "7-29_融合分析结果.zip",
}


def load_converter():
    spec = importlib.util.spec_from_file_location("geo_v16_converter", CONVERTER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def find_sources() -> dict[str, Path]:
    project = ROOT
    roots = [
        project,
        project.parent,
        Path.home() / "Downloads",
        Path.home() / "Desktop",
        Path.home() / "Documents",
    ]
    found: dict[str, Path] = {}
    for key, name in SOURCE_NAMES.items():
        candidates: dict[str, Path] = {}
        for root in roots:
            if not root.exists():
                continue
            for path in root.rglob(name):
                candidates[str(path.resolve()).casefold()] = path.resolve()
        if not candidates:
            raise AssertionError(f"Missing source ZIP: {name}")
        hashes = {hashlib.sha256(path.read_bytes()).hexdigest() for path in candidates.values()}
        if len(hashes) != 1:
            raise AssertionError(f"Conflicting source ZIP copies: {name}")
        found[key] = sorted(candidates.values(), key=lambda item: (len(str(item)), str(item)))[0]
    return found


def manifest_template() -> dict:
    return {"schemaVersion": "1.0.0", "generatedAt": None, "datasets": []}


def run_conversion(converter, sources: dict[str, Path], root: Path, name: str) -> tuple[dict, dict, dict]:
    run_root = root / name
    output = run_root / "yangzhanggui-2026-07-29.json"
    diagnostics = run_root / "diagnostics"
    manifest = run_root / "manifest.json"
    run_root.mkdir(parents=True)
    manifest.write_text(json.dumps(manifest_template()), encoding="utf-8")
    args = argparse.Namespace(
        geo_zip=str(sources["geo_zip"]),
        a5_zip=str(sources["a5_zip"]),
        fusion_zip=str(sources["fusion_zip"]),
        output=str(output),
        diagnostics_dir=str(diagnostics),
        target_date="2026-07-29",
        dataset_id="yangzhanggui-2026-07-29",
        mapping=str(MAPPING_PATH),
        manifest=str(manifest),
        rule_table=str(RULE_TABLE),
        rule_changelog=str(RULE_CHANGELOG),
        sanitize=True,
    )
    result = converter.convert(args)
    return result, json.loads(output.read_text(encoding="utf-8")), json.loads(manifest.read_text(encoding="utf-8"))


def node_gate(dataset_path: Path) -> dict:
    dataset_url = dataset_path.resolve().as_uri()
    adapter_url = (ROOT / "src" / "data" / "geoDashboardDataAdapter.js").resolve().as_uri()
    script = (
        "import fs from 'node:fs';"
        f"import {{adaptGeoDashboardData}} from '{adapter_url}';"
        f"const raw=JSON.parse(fs.readFileSync(new URL('{dataset_url}'),'utf8'));"
        "const result=adaptGeoDashboardData(raw,{mode:'json'});"
        "console.log(JSON.stringify({gate:result.gate.status,errors:result.errors,warnings:result.warnings,"
        "qualityCitationRate:result.dataset.overview.qualityCitationRate,"
        "averageBrandPosition:result.dataset.overview.averageBrandPosition,"
        "questionNumerator:result.dataset.dataHealth.questionCollectionCompleteness.numerator,"
        "questionDenominator:result.dataset.dataHealth.questionCollectionCompleteness.denominator,"
        "questionRate:result.dataset.dataHealth.questionCollectionCompleteness.rate,"
        "validityNumerator:result.dataset.dataHealth.collectedAnswerValidity.numerator,"
        "validityDenominator:result.dataset.dataHealth.collectedAnswerValidity.denominator,"
        "firstRecommendationRate:result.dataset.answer.metrics.firstRecommendationRate,"
        "primaryRecommendationRate:result.dataset.answer.metrics.primaryRecommendationRate,"
        "validated:result.dataset.answer.metricsValidated,"
        "legacy:result.dataset.diagnostics.legacyV1AnswerMetrics,"
        "finalScore:result.dataset.overview.finalScore,"
        "keywordTestedCount:result.dataset.keyword.summary.testedCandidateCount}));"
    )
    completed = subprocess.run(
        ["node", "--input-type=module", "--eval", script],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(completed.stdout)


def main() -> int:
    converter = load_converter()
    sources = find_sources()
    checks: list[dict[str, str]] = []

    def check(name: str, condition: bool) -> None:
        if not condition:
            raise AssertionError(name)
        checks.append({"name": name, "status": "pass"})

    for key, path in sources.items():
        check(f"{key} is readable ZIP", zipfile.is_zipfile(path))
    check("rule table is readable", RULE_TABLE.is_file())
    check("rule changelog is readable", RULE_CHANGELOG.is_file())

    with tempfile.TemporaryDirectory(prefix="geo-v16-test-") as temporary:
        temp_root = Path(temporary)
        result_a, data_a, manifest_a = run_conversion(converter, sources, temp_root, "run-a")
        result_b, data_b, manifest_b = run_conversion(converter, sources, temp_root, "run-b")
        mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))
        expected = mapping["expected"]

        check("answer count is 49", len(data_a["answer"]["records"]) == expected["targetAnswerRows"])
        check("citation count is 241", len(data_a["citation"]["records"]) == expected["targetCitationRows"])
        check("source keyword count is 13", result_a["counts"]["sourceKeywords"] == expected["targetKeywordRows"])
        check("expanded keyword count is 39", len(data_a["keyword"]["records"]) == expected["expandedKeywordRows"])
        a5_counts = data_a["diagnostics"]["a5RecordCounts"]
        check("5A asset count is 1", a5_counts["asset"] == 1)
        check("5A flow count is 1", a5_counts["flow"] == 1)
        check("eight audiences count is 8", a5_counts["audience"] == 8)
        check("brand mind count is 50", a5_counts["brandMind"] == 50)
        check("industry opportunity count is 73", a5_counts["industryOpportunity"] == 73)

        answer_counts = Counter(item["platformId"] for item in data_a["answer"]["records"])
        citation_counts = Counter(item["platformId"] for item in data_a["citation"]["records"])
        check("platform answer counts match", dict(answer_counts) == expected["platformAnswerRows"])
        check("platform citation counts match", {key: citation_counts.get(key, 0) for key in expected["platformCitationRows"]} == expected["platformCitationRows"])

        overview = data_a["overview"]
        score_mapping = {
            "finalScore": "final_score",
            "geoStructureScore": "geo_structural_quality_score",
            "geoSemanticScore": "geo_semantic_score",
            "geoScore": "geo_score",
            "fiveAScore": "a5_score",
            "industryOpportunityScore": "industry_opportunity_driver_score",
        }
        check("authoritative scores match", all(overview[key] == expected["scores"][source] for key, source in score_mapping.items()))
        source_counts = {item["id"]: item["count"] for item in data_a["citation"]["sourceTypes"]}
        check("citation classification is 0/107/134", all(source_counts.get(key, 0) == value for key, value in expected["citationSourceTypeCounts"].items()))
        trigger_counts = {item["id"]: item["count"] for item in data_a["keyword"]["triggerTypes"]}
        check("legacy keyword values are diagnostics only", overview["keywordEffectivenessScore"] is None and data_a["diagnostics"]["legacyKeywordMetrics"]["historicalTestedCount"] == 39 and data_a["diagnostics"]["legacyKeywordMetrics"]["historicalTriggeredCount"] == 0 and data_a["diagnostics"]["legacyKeywordMetrics"]["historicalKeywordEffectivenessScore"] == 30)
        check("candidate keyword test and trigger are N/A", data_a["keyword"]["summary"]["testedCandidateCount"] is None and data_a["keyword"]["summary"]["triggeredCandidateCount"] is None and trigger_counts.get("citationTriggered") is None)
        check("industry Top10 order matches", [item["keyword"] for item in data_a["keyword"]["topKeywords"]] == expected["industryTop10"])
        check("missing business metrics remain null", overview["averageBrandPosition"] is None and overview["qualityCitationRate"] is None and data_a["keyword"]["metrics"]["averageCommercialValue"] is None)
        completeness = data_a["dataHealth"]["questionCollectionCompleteness"]
        validity = data_a["dataHealth"]["collectedAnswerValidity"]
        theoretical_validity = data_a["dataHealth"]["theoreticalValidCompleteness"]
        check("theoretical platform-question combinations are 72", completeness["denominator"] == 72)
        check("actual platform-question combinations are 49", completeness["numerator"] == 49)
        check("question completeness is 68.06 percent", abs(completeness["rate"] - 68.05555556) < 0.00000001)
        check("missing platform-question combinations are 23", len(completeness["affectedQuestions"]) == 23 and len(data_a["diagnostics"]["missingPlatformQuestionCombinations"]) == 23)
        check("missing combination records are explicit", all(set(("platformId", "questionId", "question", "expected", "collected", "reason")).issubset(item) for item in completeness["affectedQuestions"]))
        check("invalid answer is source evidenced", validity["numerator"] == 48 and validity["denominator"] == 49 and len(data_a["diagnostics"]["invalidAnswerEvidence"]) == 1)
        invalid_evidence = data_a["diagnostics"]["invalidAnswerEvidence"][0]
        check("invalid answer historical semantic category is unmentioned", invalid_evidence["historicalSemanticCategory"] == "未提及" and invalid_evidence["brandMentioned"] is False)
        validated = data_a["answer"]["metricsValidated"]
        check("validated answer denominator is 48", validated["validAnswerCount"] == 48 and validated["denominator"] == 48 and validated["ruleBasis"] == "valid_answers_only")
        check("validated answer counts match source roles", validated["brandMentionCount"] == 8 and validated["primaryRecommendationCount"] == 0 and validated["secondaryRecommendationCount"] == 4 and validated["brandRecommendationCount"] == 4 and validated["softPlacementCount"] == 2 and validated["unmentionedCount"] == 38)
        check("validated answer rates use denominator 48", abs(validated["brandMentionRate"] - 16.66666667) < 0.00000001 and validated["primaryRecommendationRate"] == 0 and abs(validated["secondaryRecommendationRate"] - 8.33333333) < 0.00000001 and abs(validated["brandRecommendationRate"] - 8.33333333) < 0.00000001 and abs(validated["softPlacementRate"] - 4.16666667) < 0.00000001 and abs(validated["unmentionedRate"] - 79.16666667) < 0.00000001)
        check("semantic role classes are mutually exclusive", validated["rolesMutuallyExclusive"] is True and validated["roleCountTotal"] == 48 and sum(validated["roleDistribution"].values()) == 48)
        legacy_answer = data_a["diagnostics"]["legacyV1AnswerMetrics"]
        check("legacy V1 answer metrics remain unchanged", legacy_answer["brandMentionRate"] == 16.33 and legacy_answer["primaryRecommendationRate"] == 0 and legacy_answer["secondaryRecommendationRate"] == 8.16 and legacy_answer["brandRecommendationRate"] == 8.16 and legacy_answer["softPlacementRate"] == 4.08 and legacy_answer["unmentionedRate"] == 79.59)
        check("legacy V1 answer metrics are non-formal and include invalid", legacy_answer["denominator"] == 49 and legacy_answer["status"] == "historical" and legacy_answer["includesInvalidAnswer"] is True and legacy_answer["formalUse"] is False and legacy_answer["ruleVersion"] == "GEO_FUSION_V1_RULE_FIX_2026-07")
        check("historical final score remains unchanged", data_a["overview"]["finalScore"] == 53.6)
        check("collected answer validity is 97.96 percent", abs(validity["rate"] - 97.95918367) < 0.00000001)
        check("theoretical valid completeness is 66.67 percent", theoretical_validity["numerator"] == 48 and theoretical_validity["denominator"] == 72 and abs(theoretical_validity["rate"] - 66.66666667) < 0.00000001)
        check("data health is warning", data_a["dataHealth"]["overallStatus"] == "warning")
        check("batch confidence is low", data_a["metadata"]["confidenceLevel"] == "low" and data_a["dataHealth"]["qualityStatus"] == "low_confidence")
        check("batch is excluded from formal trends", data_a["metadata"]["formalTrendEligible"] is False and data_a["diagnostics"]["aggregateTrendComparison"]["formalTrend"] is False)
        check("real snapshot dates are July 22", data_a["metadata"]["fiveASnapshotDate"] == "2026-07-22" and data_a["metadata"]["brandMindSnapshotDate"] == "2026-07-22")
        check("snapshot lag is seven days", data_a["metadata"]["lagDays"] == 7 and data_a["metadata"]["fiveALagDays"] == 7 and data_a["metadata"]["brandMindLagDays"] == 7)
        check("first recommendation remains undefined", overview["firstRecommendationRate"] is None and data_a["answer"]["metrics"]["firstRecommendationRate"] is None and data_a["answer"]["summary"]["firstRecommendations"] is None and all(item["isFirstRecommendation"] is None for item in data_a["answer"]["records"]))
        check("primary recommendation rate is 0 percent", data_a["answer"]["metrics"]["primaryRecommendationRate"] == 0)
        check("secondary recommendation rate is 8.16 percent", data_a["answer"]["metrics"]["secondaryRecommendationRate"] == 8.16)
        check("brand recommendation rate is 8.16 percent", data_a["answer"]["metrics"]["brandRecommendationRate"] == 8.16)
        check("Kimi citation status is neutral", data_a["diagnostics"]["kimiCitationEvidenceStatus"] == "unknown_or_no_returned_citation" and "抓取失败" not in json.dumps(data_a["citation"]["abnormalSources"], ensure_ascii=False))
        check("business rule versions are complete", all(data_a["metadata"].get(key) for key in ("analysisRuleVersion", "qualityRuleVersion", "dataContractVersion", "presentationVersion", "ruleDocumentVersion", "rulesExtractedAt")))
        check("problem trends are empty", data_a["trends"] == [])

        serialized = json.dumps(data_a, ensure_ascii=False, allow_nan=False)
        check("output excludes NaN and Infinity", "NaN" not in serialized and "Infinity" not in serialized)
        check("output excludes local paths", "C:\\Users\\" not in serialized and "file://" not in serialized)
        check("output excludes full AI answers and share links", "对话分享链接" not in serialized and all(len(str(item.get("answerExcerpt", ""))) <= 180 for item in data_a["answer"]["records"]))
        check("all answer ids are unique", len({item["recordId"] for item in data_a["answer"]["records"]}) == 49)
        check("all citation ids are unique", len({item["citationId"] for item in data_a["citation"]["records"]}) == 241)

        check("two runs produce identical data", data_a == data_b)
        check("two runs produce identical SHA-256", result_a["sha256"] == result_b["sha256"])
        entry_a = manifest_a["datasets"][0]
        check("Manifest sizeBytes matches output", entry_a["sizeBytes"] == result_a["sizeBytes"])
        check("Manifest SHA-256 matches output", entry_a["sha256"] == result_a["sha256"])
        check("Manifest is deterministic", manifest_a == manifest_b)

        gate = node_gate(temp_root / "run-a" / "yangzhanggui-2026-07-29.json")
        check("V1.3 Adapter/Validator returns warning", gate["gate"] == "warning" and not gate["errors"])
        check("V1.3 Adapter preserves null metrics", gate["qualityCitationRate"] is None and gate["averageBrandPosition"] is None and gate["firstRecommendationRate"] is None and gate["keywordTestedCount"] is None)
        check("V1.3 Adapter preserves corrected completeness", gate["questionNumerator"] == 49 and gate["questionDenominator"] == 72 and abs(gate["questionRate"] - 68.05555556) < 0.00000001)
        check("V1.3 Adapter preserves corrected validity", gate["validityNumerator"] == 48 and gate["validityDenominator"] == 49)
        check("V1.3 Adapter preserves primary recommendation", gate["primaryRecommendationRate"] == 0)
        check("V1.3 Adapter preserves validated answer metrics", gate["validated"]["denominator"] == 48 and abs(gate["validated"]["brandMentionRate"] - 16.66666667) < 0.00000001)
        check("V1.3 Adapter preserves separate legacy answer metrics", gate["legacy"]["denominator"] == 49 and gate["legacy"]["includesInvalidAnswer"] is True)
        check("Adapter does not recompute the historical final score", gate["finalScore"] == 53.6)

    output = {
        "status": "pass",
        "passed": len(checks),
        "failed": 0,
        "sourceFiles": {key: {"name": path.name, "sizeBytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for key, path in sources.items()},
        "deterministicSha256": result_a["sha256"],
        "checks": checks,
    }
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
