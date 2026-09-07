# Brand Mind homepage continuous memory field

Status: **READY FOR HUMAN VISUAL REVIEW**, not a production visual freeze.

Independent branch: `feat/home-brandmind-memory-field`, based on
`b444a2b8b6bc2ffbddbec99dd562bed200981a36`. Historical worktrees and their
untracked art/cache remain untouched.

## Scope and rollback

Enable with the existing repaired-M3 `homeArt=final` homepage plus
`brandMindMemory=1` (selected C). `brandMindMemory=A|B|C` selects one of the
three structural candidates. Omit the flag or use `0` for the exact old
homepage implementation. Other hero modes and the default site are unchanged.

No Galaxy asset, LDI/config/bloom, Earth, FiveA, GEO, BrandMindScene, data
panel, Camera, Route, Scroll, Handoff, renderer or interaction-manager edits.
The existing Brand Mind anchor, envelope transform, label, hover and 450 ms
entry intent are retained. The six homepage knots are decorative art, not
business entities or bindings to the internal association registry.

## Three candidates / one correction

- A: layered saddle; the lowest knot was too detached.
- B: interleaved diagonal banks; readable voids, but the ends looked separated.
- C: asymmetric archipelago; strongest unified center and irregular outline.

One meaningful cohesion correction was applied to C: embed knots in the same
continuous density field, reduce field-grain energy by 26%, and increase sparse
thread energy. No positions, particle counts or connection topology changed.
No second correction or fourth candidate was made.

## Implementation

Two GPU batches replace the legacy ten Brand Mind visual batches (label stays):

1. Five depth slices in one InstancedMesh sample a continuous anisotropic
   multi-bank density function with fractal modulation, two soft voids and
   knot-associated low-frequency mass. This is an economical density-slice
   approximation, not raymarched scattering or separate bokeh sprites.
2. One immutable point buffer: 23,500 field grains, 6,900 particles distributed
   among six skewed knots, 4,200 dim deep-dust particles and 900 particles on
   six partial curved association paths. Total: **35,500**.

Animation only updates four uniforms; static geometry never rebuilds/uploads
per frame. Correlated slow drift keeps clumps coherent; breathing/shimmer and
thread modulation are restrained. No new renderer, composer, RAF or listener.
Linear shader values feed the existing output pipeline; the density field is
sub-bloom, and only sparse high-energy knot particles qualify for existing
bloom. Global exposure and postprocessing are unchanged.

## Current-runtime evidence (2026-09-07, HOME)

Edge / ANGLE Direct3D11: **NVIDIA GeForce RTX 5060 Ti**, not software rendering.
1600x900, DPR 1. Steady-state 240-frame sample:

- 120.01 FPS; median frame time 8.3 ms, p95 8.5 ms.
- Full composer frame: **62 draw calls**, baseline 70. Brand Mind visual: 2.
- Isolated composer frame: 16 calls including existing postprocessing.
- GPU-wide VRAM: 1,513 / 16,311 MiB, utilization 25%. This includes other
  processes and must not be claimed as per-page VRAM usage.
- Console/runtime errors 0; Canvas 1; primary RAF 1; wheel listener 1.

Compile/loading frames are excluded from steady FPS; the loop's lifetime
average includes startup and is lower. These are browser measurements, not
FPS inferred from the display refresh setting.

Visual inspection compared baseline with all three candidates, final runtime,
isolated view, 640x360 small read and left/center/right existing-camera motion.
The bokeh disks are gone; memory mass, irregular knots and voids are perceptible.
Galaxy remains dominant. Threads intentionally require a closer look. No
visible slicing/ghosting was found under the tested small camera motion.
This is readiness for human review, not a claim of human approval.

## Validation and reproduction

- All related source suites: **606/606**, 33 suites (581 JSON-reported tests
  plus the existing 25-test renderer inventory suite).
- `npm run build`: PASS. `git diff --check`: PASS.
- Existing Edge interaction regression: GEO / FiveA / Brand Mind direct entry
  and return to `HERO_START`, routeIndex 0; both data panels open/close: PASS.
- FiveA A1-A5 scale/energy and all four transition flowStrength real renderer
  bindings: PASS. Canonical/binding/replay/registry regressions remain intact.

Run `tools/brandmind-memory-gate.cjs` with the approved existing Playwright
installation (`NODE_PATH` if needed), `MEMORY_BASE_URL`, `MEMORY_CANDIDATE=C`
and `MEMORY_OUTPUT=art/brandmind-memory/final`.
Run `tools/brandmind-memory-evidence.py` for lossless evidence layouts/small read.
It resizes screenshots only; it never grades or repairs rendered pixels.
Run the existing `tools/home-final-art-regression.cjs` with
`HOME_REGRESSION_URL` set to the full memory URL and
`HOME_REGRESSION_OUTPUT=art/brandmind-memory/regression`.
Run `node tools/m3-regression.cjs` for all current source test suites.

Local evidence lives under `art/brandmind-memory/`; screenshots and machine
reports are intentionally excluded from the commit. Browser debug overlays
are validation-script-only, not shipped as an additional UI or canvas.

Next, only if human review approves: homepage FiveA Journey readability at
small scale. Do not automatically begin it or touch FiveA internal visuals.
