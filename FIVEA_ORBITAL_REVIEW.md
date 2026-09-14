# FiveA Orbital System V1.2 — experimental candidate

**NOT READY — no human approval, freeze or Master integration.**

The user explicitly approved a different internal FiveA art direction: one
central luminous 5A star, five independently orbiting A1–A5 satellites, five
weak art tracks, and the original Core → Data Panel interaction. This replaces
the V1.1 right-side chain only when `fiveAOrbital=B` is selected. It is not a
business-contract change. No Earth/Hybrid asset, HOME layout, Galaxy, GEO,
Brand Mind, global camera, route, wheel protocol or Panel content was changed.

## Verified base and boundaries

- Latest common remote at task start: `d4f4a2c40b975dcbcbb96e6284b1aeff2629237c`.
- Parent V1.1 candidate: `0913b0fe037957bafec0ef2abf8e3cd74ae97563`, verified
  remote and containing the common base. Independent feature/worktree:
  `feat/fivea-orbital-system-v12` / `ActiveTheory-FiveA-Orbital-V12`.
- The parent's untracked art and every older worktree remain untouched.
- No external image asset, Earth texture, generated video plate, Blender,
  dependency, global postprocessing pass or second render loop was introduced.

## Art implementation and two corrections

Skeleton A/B used the same ordered radii but different disc inclinations.
A's outer track was too close to the upper boundary; B was selected after
native screenshots and a 30-second real-browser orbit recording.

The existing scene entry/return wrapper now optionally uses local orbital parts.
Five sphere meshes share geometry and one shader program, but own independent
energy uniforms. The Core uses the same material family with a stronger internal
activity component and an opaque, depth-writing surface. Meso aggregation,
fine granularity and silver-blue emission are deterministic; no Earth textures.
A shared 3,300-point surface/dust batch augments the six bodies. Five tracks
are one depth-tested LineSegments batch; solid spheres occlude their back halves.

- Correction 1: initial integrated labels rendered too small; compensated glyph
  size for depth and local presentation scale. Added low-frequency Core activity
  to distinguish it from the darker satellites without global exposure changes.
- Correction 2: a full-period maximum-scale check found A5's near-side arc could
  leave the top of the viewport. Reduced only the local presentation scale
  `.80 → .68`, and the open-Panel scale `.43 → .26`. No shared camera change.
- Both allowed visual corrections are used. No third correction was performed.

## Orbit and business identities

| ID | art radius | sphere radius | initial phase (rad) | angular speed (rad/s) |
|---|---:|---:|---:|---:|
| A1 AWARE | 1.08 | .123 | 2.85 | .055 |
| A2 APPEAL | 1.49 | .140 | .65 | .047 |
| A3 ASK | 1.90 | .158 | 4.50 | .040 |
| A4 ACT | 2.31 | .138 | 1.95 | .034 |
| A5 ADVOCATE | 2.72 | .132 | 5.85 | .029 |

All revolve in one direction on mildly differing planes. Orbit position comes
from art time and stable ID only. Data scale affects StageVisual beneath
OrbitPose, never its translation/radius. The shared particle matrix, actual
sphere, label anchor and current Transition endpoints use this same pose.
The Core stays central, and Opportunity remains data/Panel content, not A6 or a
sixth satellite. There were no stage-specific click panels in the prior scene;
none were invented here. Core picking reuses the existing raycaster and input
state, with a small smoothed material hover response.

Only the original scale/energy and four alpha-only flowStrength bindings apply.
The existing review harness routes LOW/HIGH/PARTIAL through Canonical → Derived
→ VisualState → BindingPlan → actual adapters and the same Panel consumer.
No density/flowSpeed mapping, guardrail, missing policy or business algorithm
changed. Safe missing-data fallbacks remain distinct from real business zeros.

Four flows retain 432 points, 108 per adjacent stable-ID edge. Their smooth
polar curves interpolate moving endpoints outside the Core; continuous,
unwrapped art phases avoid shortest-angle wrap jumps. No Core-to-stage business
links exist. Thin sparse points, not large white bead chains, express migration.
Over long time differences the curves can wind further; this is an art trajectory,
not a conversion-speed representation.

The local accumulated clock uses existing delta, skips hidden/inactive intervals,
and caps resume gaps. Opening the Panel pauses orbital time; closing continues
from it, with no reset. The DEV-only `orbitalReview=1` sampling hook advances the
same scene for geometric checks, not a second RAF or product UI.

## Evidence and checks

`tools/fivea-orbital-review.cjs skeleton|capture|video|cycle|checks` uses headed
Edge at 1600×900 DPR1. Normal captures are native PNG. Overview/data comparison
freeze t=12; baseline uses V1.1 B with the same Snapshot and camera. The Core
closeup is an explicitly labelled native 310×310 pixel crop, not a separate
camera or a fake resolution increase. Small Read is a 640×360 derivative.

The final 51.32-second MP4 derives from 1,280 native CDP PNG frames with original
timestamps, including over 32 seconds of normal independent orbital motion,
stage/flow changes, real Core click, button/ESC close, return, reentry and return.
Only standard RGB-to-BT.709 video encoding was applied, not retiming, grading or
fake particles. MP4 is lossy; the original PNG sequence remains local. An early
probe used the wrong accessible close-button name; its failed evidence is
retained, and only the test locator was fixed before recording again.

- Current complete Node inventory: 42 files, **667 named cases**, 0 failures,
  0 skips; **10 new orbital cases**. 87 Node wrapper items are not assertions.
- Build, `git diff --check`, Python PNG integrity/comparison assembly PASS.
  No asset-generating Python path was changed or rerun.
- Real GEO/FiveA/Brand Mind entry/return, both Panels, five scale/energy and
  four flowStrength proofs PASS. Console/runtime errors 0; Canvas/RAF/Wheel
  1/1/1. Existing pointer listener counts remain unchanged.
- Full slowest-orbit period, 216.66s / 241 samples, at maximum data scale:
  main-view viewport exits 0; physical collisions 0; minimum sampled satellite
  surface clearance .4575 local units; fully hidden body events 0 in projected
  circle checks. These approximate screen checks supplement real frame review,
  not a claim of pixel-exact occlusion proof. The original A3 label can briefly
  pass behind the Core; no label side-flipping was added to hide real occlusion.

## Remaining gate failure — stop, do not promote

Additional open-Panel full-period checks at 1366×768, 1600×900 and 1920×1080
found A5 can intersect the left viewport boundary around t=99s. Maximum-scale
projected overflow is approximately 3.5 / 4.5 / 5.4 pixels respectively; each
size has 16 flagged phase samples. Main view is clear; Core remains clickable,
and Panel data/phase restoration work. Nevertheless, this violates the requested
all-phase Panel framing constraint. `PANEL_EXTREME_PHASE_99.png` records the
corresponding real scene, alongside the worst-scale geometric calculation.

**NOT READY.** Preserve as an experiment; do not call the user visual gate passed.
The remaining work is a bounded local Panel framing/label margin correction,
but it is deliberately deferred because this task's two corrections are spent.
No automatic next module or shared-baseline integration is authorized.

Performance records are stored separately under `art/fivea-orbital/performance/`:
same visible Edge, 120Hz, DPR1, 10s excluded warmup, 60s steady and 60s interaction
without capture. Do not use recording/startup average FPS as the measured result.
All PNGs, video, geometry samples, test logs and reports remain outside Git.

## Final measured performance

Headed Edge 152 / ANGLE D3D11, RTX 5060 Ti (driver 591.86), desktop 120Hz,
1600×900 DPR1, visible window, identical excluded 10s warmup. No capture during
each 60s window. Pointer and Snapshot/Panel interaction are separate windows.

| Version / window | Median / P95 / P99 / max (ms) | >50 / >100ms | Frame draw calls |
| --- | --- | --- | --- |
| V1.1 steady | 8.3 / 8.5 / 8.5 / 8.6 | 0 / 0 | 39 |
| V1.1 pointer | 8.3 / 8.5 / 8.5 / 8.6 | 0 / 0 | 39 |
| V1.1 Snapshot / Panel | 8.3 / 8.5 / 8.5 / 24.9 | 0 / 0 | mean 38.86 |
| Orbital steady | 8.3 / 8.5 / 8.5 / 8.6 | 0 / 0 | 30 |
| Orbital pointer | 8.3 / 8.5 / 8.5 / 9.0 | 0 / 0 | 30 |
| Orbital Snapshot / Panel | 8.3 / 8.4 / 8.5 / 24.9 | 0 / 0 | 30 |

Measured steady frame rate is approximately 120 FPS for both. Separate GPU
queries (EXT_disjoint_timer_query_webgl2, main render callback including Composer,
15s after 10s warmup, 60 samples/version, no disjoint results): V1.1 median
2.839ms / P95 3.694ms; orbital median 2.761ms / P95 4.024ms. GPU P95 did not
improve; do not confuse fewer draw calls with a guaranteed GPU-time reduction.

Actual orbital Point geometry totals 3,992 vertices: Core 900, satellites 2,400,
four flows 432, background 260. Per main pass, sphere bodies use six draws,
five tracks one batch, surface particles one batch and four flows one batch;
labels/background and existing postprocessing account for other work. No texture
assets were added. Board-wide nvidia-smi observation was 1,495 / 16,311 MiB;
this includes other applications and is neither per-process VRAM nor a peak.

Final housekeeping scopes transfer frustum-culling changes to the orbital flag
and derives orbital diagnostic particle counts from actual geometry at creation.
These do not change the measured orbital render path or visual parameters.
