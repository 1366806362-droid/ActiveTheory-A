# M3 source and runtime continuity candidate

Status: READY FOR HUMAN VISUAL REVIEW, not final production/art approval.
Opt-in: `?galaxyV3=1&galaxyHero=repaired_m3&earthV2=1&earthV3=1`.
Other cinematic/debug switches retain their existing behavior.

## Rollback and scope

- `final_m3` and its five original runtime assets remain as the previous
  experimental, NOT READY reference. `repaired_m3` uses an independent directory.
- V4, V5, V5.1 and V6 are not replaced. Default Legacy is not promoted to M3.
- All pending M3 integration/transfer source is included as this candidate's
  prerequisite. Local art, screenshots, caches and other worktrees are excluded.
- Earth, business geometry/positions, typography, camera, route, scrolling,
  entry, FiveA/Brand Mind panels and V2 renderer bindings are not edited.

## Actual source gap

V5 and V5.1 `suppress_target_overlays` removes rectangles for old Home business
labels. In particular x=1110..1530, y=0..235 removes genuine upper-right galaxy
material. M3 inherits this absence; alpha conservation cannot recover it.

`repair_m3_source.py` reconstructs only a soft upper/right footprint from
registered clean-Master low/mid/high-frequency bands. Existing M3 fields gate
support and existing source mass gates the deficit. Dust and cluster variation
come from the clean donor, not procedural particles, mirrored arms or a bright
line. 89.23% of source pixels and the protected Core are unchanged. M3 pitch,
phase, widths, scale and tilt are unchanged. No source correction was required.

## LDI and display

Five soft depth-role layers reuse the validated coverage-conserving split and
HOME inverse-ACES display transport. Fixed linear texture storage gain is 8,
decoded only by M3 materials. Reference exposure is .76; other output profiles
are not validated. Nearest alpha quantization plus actual coverage compensation
retain faint support. Authoritative repaired display samples are not floored
again after unpremultiplication. Arm and halo metrics use floating-point
Gaussian filtering to avoid 8-bit analysis-floor artifacts.

## Core bloom

The original UnrealBloomPass raises Core mean luminance to 111.02% of source;
pixels above display luminance .7 grow from 2576 to 5126 in the fixed fixture.
The opt-in calibration keeps only 12% of high-pass bloom eligibility in a small
world-projected Core region with smooth edges. Direct rendered light is untouched.
Global bloom threshold .78, strength .3, radius .11 and exposure remain unchanged.
Calibrated mean is 101.85%; high area is 2867. No runtime correction was required.
Owner/ancestor visibility disables the region on other scenes. No new pass,
render target, renderer, mesh, RAF or listener is created by the calibration.

## Reproduction (HOME only)

Inputs remain local under `art/visual-gate/home-target-v1/`:
`GALAXY_MASTER_REFERENCE_V1.png`, `GALAXY_MASTER_MASS_FIELD.png` and approved M3
preview; V5.1 WebPs are tracked. The original M3 preview SHA256 is
491af2be9db3d33092a2ccdb38b79ea91857421e07c7d97cb272042b573634e2.
Python requires existing NumPy/Pillow only. No depth model or Blender runs.

1. `py -3 tools/galaxy-v3-blender/repair_m3_source.py` (inspect Source first).
2. After Source approval: `py -3 tools/galaxy-v3-blender/build_repaired_m3.py`.
3. `py -3 tools/galaxy-v3-blender/test_m3_source_repair.py` and
   `py -3 tools/galaxy-v3-blender/test_m3_display_transfer.py`.
4. Start Vite on 5180. Supply Playwright on NODE_PATH if not installed locally.
   Set `M3_HERO=repaired_m3`, `M3_OUTPUT_DIR=art/m3-source-repair`; run
   `node tools/m3-runtime-gate.cjs` and `node tools/m3-core-bloom-gate.cjs`.
5. `py -3 tools/galaxy-v3-blender/report_repaired_m3.py`.
6. `node tools/m3-regression.cjs`, `npm run build`, `git diff --check`.

Local evidence is in `art/m3-source-repair/`. One historical HOME shader precision
warning remains; no new console error or runtime exception was observed.
Business entrance labels remain weak in the frozen composition. Their visibility
is a separate subsequent visual milestone, not part of this repair.
