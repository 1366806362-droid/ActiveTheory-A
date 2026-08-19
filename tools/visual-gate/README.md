# Rapid Beauty Gate V1

Rapid Beauty Gate is a small, generic pre-production stop for Galaxy, Earth,
GEO, 5A, Brand Mind, Hero, and other expensive visual experiments. It produces
one low-cost Beauty image and then stops for human review.

## Locked defaults

- Maximum resolution: 1280 x 720
- Maximum samples: 16
- Passes: Beauty only
- Denoise: on
- Maximum gate time: 300 seconds
- Denoise: configured by the experiment renderer and expected to be on
- Full production: blocked until an explicit human `PASS`

The gate never starts 2K/4K output, higher samples, auxiliary passes, a full
sequence, encoding, or website integration.

## Builder and renderer contract

`builder` and `renderer` are project-relative script paths. Python, PowerShell,
and executable files are supported. With empty `builderArgs` / `rendererArgs`,
the gate calls each script with:

```text
--visual-gate-stage build|render
--config <absolute-config-path>
--output-directory <absolute-output-directory>
```

For existing tools with different command lines, provide argument templates in
`builderArgs` and `rendererArgs`. Supported placeholders are `{config}`,
`{outputDirectory}`, `{outputFile}`, `{resolutionX}`, `{resolutionY}`, and
`{samples}`. Dry-run checks scripts and safety locks without invoking them.

## Company-safe checks

```powershell
python tools/visual-gate/validate_visual_gate.py --config tools/visual-gate/visual_gate_config.json
python tools/visual-gate/run_visual_gate.py --config tools/visual-gate/visual_gate_config.json --dry-run
python tools/visual-gate/test_visual_gate.py
```

## Run one Beauty gate

Edit or copy the config for the experiment, then run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/visual-gate/run_visual_gate.ps1 -Config tools/visual-gate/visual_gate_config.json
```

Successful rendering writes `BEAUTY_GATE.png`, `visual-gate-result.json`, and
`visual-gate.log` under `art/visual-gate/<experiment-id>/`. The initial status
is always `AWAITING_VISUAL_REVIEW`, never `PASS`.

## Human review

```powershell
python tools/visual-gate/validate_visual_gate.py --result-file art/visual-gate/<experiment-id>/visual-gate-result.json --result PASS
```

or:

```powershell
python tools/visual-gate/validate_visual_gate.py --result-file art/visual-gate/<experiment-id>/visual-gate-result.json --result NOT_READY
```

Only a result currently awaiting review can be approved. `GATE_TIMEOUT` and `ERROR`
cannot be promoted to `PASS`; they remain `FULL_PRODUCTION_BLOCKED`.

The time budget is a gate and reporting lock, not a destructive Blender kill.
If Beauty completes after the configured budget, the result is retained but is
marked `GATE_TIMEOUT`, and no production stage is started.
