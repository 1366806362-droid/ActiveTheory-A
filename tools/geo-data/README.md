# GEO V1.6.2 real-data converter

This offline tool converts the locked 2026-07-29 GEO, 5A/brand-mind, and fusion-analysis ZIP packages into one deterministic `GeoDashboardDataset` JSON file. It does not recompute the fused business scores and it does not add Excel parsing to the browser bundle.

## Environment

Use Python 3.12+ with `openpyxl` 3.1.x. The company workstation uses the project-external environment:

```powershell
C:\Users\Administrator\Documents\ActiveTheory-Tooling\geo-v16-venv\Scripts\python.exe -c "import openpyxl; print(openpyxl.__version__)"
```

## Conversion

```powershell
& 'C:\Users\Administrator\Documents\ActiveTheory-Tooling\geo-v16-venv\Scripts\python.exe' tools/geo-data/convert_real_geo_dataset.py `
  --geo-zip '<SOURCE>\7-29_GEO_Module_Pack (2).zip' `
  --a5-zip '<SOURCE>\7-29_5A+品牌心智清洗结果 (1).zip' `
  --fusion-zip '<SOURCE>\7-29_融合分析结果.zip' `
  --output 'public/data/geo-dashboard/yangzhanggui-2026-07-29.json' `
  --diagnostics-dir 'art/geo-dashboard/v16-real-data-20260729' `
  --target-date '2026-07-29' `
  --dataset-id 'yangzhanggui-2026-07-29' `
  --rule-table '<RULES>\GEO_Codex分析规则总表_V1.md' `
  --rule-changelog '<RULES>\GEO_Codex规则变更日志_V1.md' `
  --sanitize
```

The converter extracts into a temporary directory, identifies workbooks by worksheet/header signatures, joins row-level data to the authoritative fusion tables, runs reconciliation and public-data safety checks, writes stable UTF-8/LF JSON, updates the existing V1.4 Manifest entry, and removes the temporary extraction directory.

The V1.6.2 correction reads the formal rule table and changelog as higher-priority evidence. It preserves the V1 fusion score values as low-confidence historical results, but corrects the data-quality facts to 49/72 collected combinations, 48/49 valid answers, the 2026-07-22 5A and brand-mind snapshots, and a non-formal trend status. Rule file names, versions, and hashes are recorded; local rule paths are never written to the public package.

The public package intentionally keeps genuinely undefined metrics as `null`: first-recommendation rate, average brand position, quality citation rate, candidate keyword test/trigger rates, keyword commercial value, and question-level trends. Primary, secondary, and brand recommendation rates remain separate. The historical keyword effectiveness value of 30 is retained only in `diagnostics.legacyKeywordMetrics` with `status=deprecated`. Aggregated fusion trends remain under `diagnostics.aggregateTrendComparison` with `observationOnly=true` and `formalTrend=false`.

V1.6.2a also keeps answer denominators explicit. `diagnostics.legacyV1AnswerMetrics` preserves the V1 engine values over all 49 collected rows and marks them non-formal; `answer.metricsValidated` contains the independently reconciled 48-valid-answer counts and rates used by the Dashboard's current Answer presentation. The historical Final Score remains unchanged.

## Verification

```powershell
& 'C:\Users\Administrator\Documents\ActiveTheory-Tooling\geo-v16-venv\Scripts\python.exe' tools/geo-data/test_real_geo_converter.py
node src/data/geoDashboardDataContract.test.mjs
node src/data/geoDashboardJsonLoader.test.mjs
node src/data/geoDashboardFileLoader.test.mjs
npm run build
git diff --check
```

The Python verification discovers only the approved local roots, requires duplicate ZIP copies to have identical SHA-256 values, performs two isolated conversions, compares byte hashes, checks reconciliation/sanitization invariants, and invokes the existing V1.3 Adapter/Validator against the generated package.
