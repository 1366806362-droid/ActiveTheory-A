# FiveA Color & Cosmic Depth

## Shared baseline promotion — 2026-09-15

Human accepted source `310cffe310eedcaca31d1664aba16900f4f80342`.
Normal FiveA entry now resolves the reviewed orbital B / particle-stars B /
energy-stars A / color-depth A combination without candidate query parameters.
Use explicit `fiveAOrbital=0` for the legacy implementation; historical explicit
candidate parameters remain available. This promotion changes no approved art
values and does not change the MOCK/SYNTHETIC data identity or enable density or
flowSpeed.

Source: `feat/fivea-orbital-energy-stars-v13` at
`3b131b8daba07827720b0f59378ac258b8cd17bb`, containing verified shared baseline
`d4f4a2c40b975dcbcbb96e6284b1aeff2629237c`. Independent worktree/feature;
promoted after human acceptance to the shared baseline.

## Art and isolation

- Opt in with `fiveAOrbital=B&fiveAParticleStars=B&fiveAEnergyStars=A&fiveAColorDepth=A`.
  Omit `fiveAColorDepth` to recover the preceding candidate. Add
  `fiveABackground=0` to compare environment only. HOME meteor flag is independent.
- Same 14,750 particle batch, stable-ID A1 ice cyan / A2 soft teal / A3 lavender /
  A4 champagne / A5 rose copper. Palette is converted from sRGB to linear; existing
  tone mapping, output conversion and global Bloom/exposure are unchanged.
  Colors encode identity only, not risk, conversion or missing data.
- Main Core physical radius .48 -> .576 (+20% diameter), including matrix,
  support/hit proxy and label anchor. Orbit radius, inclination, phase, direction,
  speed, authoritative time and four business paths remain unchanged.
- Local environment: one irregular continuous blue-gray gas field behind the
  system, one batch of 208 distant stars and 12 faint near dust samples. Old
  260-point decorative dust is hidden, not compounded. Net visible environment
  particles -40; net draw calls +1. No new global fog, Renderer, Composer or RAF.
- Two environment candidates: A restrained separated clumps; B wider, stronger
  backdrop. A selected in full-scene comparison, not a close-up beauty-only gate.
  One correction: collision avoidance for Panel label anchors only. No orbit
  repositioning. No additional material iterations.

## Panel and bindings

The earlier fixed-time capture passed delta=0 to the existing loop, preventing
the Panel's local fit damping from settling. Live-delta capture with orbital
sample time fixed at 12s resolves the screenshot mismatch; no shared loop change.
Fully expanded and fully restored captures are separate. Candidate glyph anchors
avoid overlapping labels during settled Panel mode without moving orbit bodies.

Full 750-second sampling at maximum legal satellite scale, body and label margins:
1366x768 minimum margin 37.52px; 1600x900 47.17px; 1920x1080 103.17px.
Panel pause/wheel isolation/resume and reduced-motion suppression pass.

Canonical/Derived/VisualState/BindingPlan/Renderer remain authoritative. Existing
LOW/HIGH/PARTIAL fixture applies exercise stage scale/energy and four flowStrength
channels. Palette, Core art radius and orbit do not consume those data values.
No density or flowSpeed enabled. Stable-ID reorder, repeat apply, disposal and
reentry tested; missing remains missing rather than zero or alarm semantics.

## Evidence and reproducibility

Local evidence: `art/fivea-color-depth/index.html` (not tracked).
Native PNG captures: overview, fixed T=12 before/after, palette, Core,
background OFF/ON, Bloom OFF/ON, settled/closed Panel and 640x360 small-read.
Comparisons have identical Snapshot, orbit phase, camera, exposure and DPR1.
No grading, sharpening or fake particle overlays. Video is real browser PNG
screencast frames encoded using original timestamps, not retimed animation.

Scripts:

- `node tools/fivea-color-depth-review.cjs prototype` / `capture`
- `node tools/color-depth-runtime.cjs safety` / `perf`
- Existing `tools/fivea-orbital-review.cjs video` with candidate URL environment
  overrides; existing HOME regression and disjoint-timer GPU probe.
- `python tools/color-depth-evidence.py` assembles labeled evidence only.

## Validation

Full existing Node entry: 45 files, 108 runner tests, 688 named actual cases,
0 failures, 0 skips; 7 new cases this milestone (4 FiveA, 3 HOME meteor).
Affected Python visual tests: 6 passed. Build and diff check passed. Bundle size
advisory is retained; no unrelated code-splitting or architecture rewrite.

Headed Edge / RTX 5060 Ti / 1600x900 DPR1 / visible 120Hz conditions. Separate
60s samples after 10s warmup, no recording or screenshots:

| Sample | Median / P95 / P99 ms | Max ms | >50 / >100ms | Draw calls |
| --- | --- | --- | --- | --- |
| Previous FiveA | 8.3 / 8.4 / 8.5 | 8.7 | 0 / 0 | 30 |
| Candidate steady | 8.3 / 8.4 / 8.5 | 9.0 | 0 / 0 | 31 |
| Candidate interaction | 8.3 / 8.4 / 8.5 | 24.9 | 0 / 0 | 31 |

These are RAF frame intervals, not GPU execution durations. Separate
`EXT_disjoint_timer_query_webgl2` samples (whole render including Composer,
10s warmup + 15s sample, every 30th frame, 60 samples, zero disjoint events):
previous median/P95 3.007/3.733ms; candidate 2.710/3.446ms. This small sample
does not prove a speedup. Browser HOME/GEO/FiveA/Brand Mind enter/return, both
Panels, all five stage bindings and four flow bindings passed with errors 0,
Canvas/RAF/Wheel 1/1/1. The 51.36s 1600x900 H.264 video covers live orbital
motion, actual fixture changes, Core hover/click, Panel pause/resume and reentry.
Full reports remain local, separate from performance-free video capture.
Browser APIs do not expose reliable total VRAM usage; no VRAM claim is made.

Remaining review: subjective color balance and background restraint require
human approval. Panel is intentionally compact at the narrowest supported desktop
width; no Panel width or global camera change was made to enlarge it.
