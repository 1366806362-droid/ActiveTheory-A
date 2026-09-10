# Earth Hybrid production-readiness experiment

**2026-09-10 — NOT READY FOR PRODUCTION.** Engineering continuity is improved;
the full realtime fallback still visibly loses photographic cloud/material
quality. Do not promote this experiment or replace frozen HOME.

## Safety and scope

- Independent `feat/home-earth-hybrid-production-readiness`, based on pushed
  `a4880f3d9bf00116991d8e64481c9216f5577d57`.
- Explicit `earthHybridProd=1` alongside the existing Hybrid / V13 / orbital
  flags. Without this new flag the old Hybrid behavior remains unchanged.
- No new source textures, EXRs, depth, cloud, atmosphere or Blender output.
  All public assets are byte-identical to a4880f3. No Camera, scene, route,
  renderer, panel, binding, Galaxy, layout or typography source changes.
- No Master merge. This checkpoint is experimental, not human approval.

## Measured starting discrepancy

Real Edge, 1600 x 900, DPR 1; same pinned HOME camera, root pose, initial phase,
sun and exposure. The two render paths were explicitly selected for comparison.
Native Earth ROI is x=0..460, y=470..900, not a magnified closeup.

- Realtime/Hybrid mean display luminance: **65.44%**.
- Visible cloud coverage above diagnostic display threshold .03: **50.66%**.
- Surface mean display luminance: **77.75%**; city energy: **55.66%** (cities
  are very weak at this approved phase).
- Atmosphere energy: **100.37%**. Both use the same live atmosphere.
- The thresholded surface-occupied count is NOT a geometric silhouette measure:
  the dark fallback drops more pixels below the threshold. Both actual surfaces
  have radius 1.85; terminator equations and geographic phase are retained.
- EXR transfer remains linear with associated-alpha conversion exactly once.
  Renderer exposure, ACES and global bloom are unchanged.

## Architecture chosen

Instead of overlapping two opaque Earth meshes, the two radiance paths are
evaluated and blended on the existing complete 3D surface and cloud spheres.
The captured depth cap is an analytic radius-1.85 sphere within 0.0001 units;
the existing full sphere is its geometric continuation, not a flat card.
No depth is rebaked. The historical decoded cap is retained but hidden under
the production flag. This is a material handoff, not a new depth mesh pipeline.

- Body combines existing realtime surface and city GLSL with projectively sampled
  frozen surface/city EXRs. Projection uses the recorded capture matrix and
  the original surface phase. City retains its own opacity and night mask.
- Cloud uses the existing cloud sphere/group and the same authoritative cloud
  phase as fallback. Premultiplied radiance is blended before conversion back
  to straight alpha, avoiding two cloud outlines.
- Per-pixel capture-facing / image-boundary support smoothly removes invalid
  projections. Unobserved points are always backed by the full realtime sphere.
- Atmosphere is the original single live shell, untouched.
- Earth remains **3 draws** in Hero, handoff and full fallback. No new mesh,
  renderer, composer, interaction owner or RAF loop.

Angular state: Hero 0..6 degrees; continuous smoothstep 6..14 degrees; full
fallback after 14 degrees. A .25-degree play/hysteresis band prevents boundary
chatter without a second timer. Angles include both view and surface/cloud drift.

Only inside the handoff band, low-frequency EXR radiance provides a bounded
luminance/coverage calibration for the realtime evaluation. Its weight tends
to zero at both endpoints. Ordinary realtime material definitions are unchanged.
This reduces the middle-band mismatch but **does not solve the final endpoint
quality drop**. Another short fade would not solve it either.

## Motion correction and range

One bounded motion correction: the old 3600-second full revolution would carry
a single captured hemisphere out of support during a long HOME dwell. The new
opt-in uses monotonic `tanh` drift from the original initial phase: surface at
most 3 degrees, clouds at most 3.33 degrees, preserving the old initial angular
velocity and 1.11 cloud ratio. Both paths use the same Horizon state/time.
This is intentionally a finite Hero drift, **not a continuously rotating globe**.
Default Earth and old Hybrid motion are unchanged.

- Normal left/center/right mouse motion: Earth horizontal span **7.17px**,
  Galaxy **1.90px**, same existing input mechanism. No extra input compression.
- Full mouse corners, 1600x900 / 1920x1080 / 2560x1440 / 1000x900, and DPR 2
  stayed in Hero. Measured angles including live drift: 0.38..1.87 degrees.
- The finite-drift limit plus measured mouse/resize offset remains below 6
  degrees. The unit test covers dwell through 24 hours without a phase reset.
- Diagnostic Earth-local Y sweeps at +/-8,10,12,15 degrees and +18 test the
  camera-relative support; production Camera code is not changed. Actual
  measured angle differs from the requested Y rotation (15 requested is about
  14.58 measured). These are not claims of a physically relit free camera orbit.
- No abrupt silhouette/city/geographic switch observed. Nevertheless the clouds
  turn visibly grayer and less photographic in full fallback: **visual gate fails**.

## Evidence and performance

Local evidence: `art/earth-prod/final/index.html`. Native ROI contact and angular
sequence preserve 460x430 pixel crops. HOME is 1600x900. The 12-second video is
actual Edge capture, encoded 1600x900 at 25 fps; render-loop FPS is measured
separately, not inferred from video frame rate. No motion blur or frame interpolation.

Steady real GPU HOME: ~120.01 FPS, P95 8.4..8.5ms, 52 total draws, 3 Earth draws.
All tested viewport/DPR cases were ~120 FPS. Initial active HOME board VRAM sample
1287 MiB / 16311 MiB; this is whole-board usage, not Earth-exclusive allocation
or a peak. The final 764 MiB sample was taken after closing the browser and is
NOT an active-render memory result.

Center comparison with original Hybrid: native ROI mean absolute RGB difference
.01386, p95 .07843 (0..1 display values), so do not claim pixel identity. Full
fallback versus original realtime at matched center: mean .00096, p95 .00392.
Full-sphere tessellation and replacement of independent cloud UV drift also
contribute to the first comparison. Source asset bytes remain unchanged.

## Regression

- All 39 current Node test files: **61 runner cases PASS** (includes existing
  script-style regression files and new handoff unit cases).
- Python visual: Earth assets 6 + M3 display/source/HOME preservation 9 = **15 PASS**.
- `npm run build` and `git diff --check` PASS.
- Browser console/runtime errors 0; Canvas 1; application RAF chain 1; wheel 1.
- GEO, FiveA and Brand Mind actual entries/returns PASS; both panels open/close.
  FiveA A1-A5 scale/energy and all four transition flowStrength bindings PASS.
- Real asset-load failure retains fallback; disposal restores borrowed materials
  without disposing shared textures; no changes outside the explicit Earth scope.

## Reproduction

Use the existing Node/Playwright + Edge, Python/Pillow/NumPy and FFmpeg setup.
Playwright video requires its FFmpeg executable; this run reused the installed
system FFmpeg 9.0 executable locally, without downloading anything.

1. Start Vite at 5188 in this worktree.
2. Keep the local baseline runtime report at `art/earth-prod/baseline/runtime-report.json`.
3. `node tools/earth-production-gate.cjs --audit`
4. `python tools/earth-production-evidence.py --audit`
5. `node tools/earth-production-gate.cjs`
6. `node tools/earth-production-motion.cjs`
7. `python tools/earth-production-evidence.py`

Runtime query: existing HOME FINAL flags plus
`earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1`.

Screenshots, logs, videos, original Master test fixtures and all caches remain
local-only. No further art correction or automatic new version follows this gate.
