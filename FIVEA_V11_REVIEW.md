# FiveA Scene V1.1 candidate

Base: `d4f4a2c40b975dcbcbb96e6284b1aeff2629237c`, explicitly fetched from
`origin/integration/active-theory-master`. Independent feature/worktree;
no Master integration, asset replacement or human approval is implied.

## Scope and selection

`fiveACinematic=B` (or `1`) opts into the internal scene candidate. Removing
the flag preserves legacy art. A retains original positions and the same new
material/path organization, for an original-camera material comparison.
No HOME entrance, camera, journey/return protocol, renderer or Composer changes.

Baseline evidence: native 1600x900 DPR1 PNG at animation time 12 with the
existing `balanced` Snapshot, plus an actual browser motion recording.
Baseline geometry, tests and sources remain recoverable at d4f4a2c.

- A: original stage positions; cleaner mid-layer aggregation and continuous
  adjacent flows. Full scene still crowded, particularly labels.
- B: same material, five stable-ID art offsets on the existing orbit roots.
  Camera and stage Z offsets are unchanged; GPU matrices, child geometry,
  label anchors and flow endpoints consume the same root.
- Correction 1: initial tiny points made wireframes dominant and labels too
  detached. Restored meso particle presence, reduced wire weight, attached labels.
- Correction 2: sparse legacy flow distribution still obscured the four links.
  All 432 existing transfer points are assigned to the four real adjacent edges,
  108 each, using stable endpoint IDs. Three-point groups share the same curved
  trajectory, with tapered tails. No extra path, point or flowSpeed binding.
  CORE→O and O→A1 legacy decorative allocations are absent in candidate mode;
  Opportunity remains its separate existing scene object, not a stage.

No further visual correction is authorized in this milestone.

## Art versus data

The 4,500-point stage batch keeps one material, per-stage matrices/opacities
and one draw. Geometry is generated once. Art distributes 36% shell, 49% mid
aggregation and 15% outer dust, with common steel/icy/silver colors and sparse
highlights. These are visual points, not one dot per person.

Original bounded Stage scale/energy and four alpha-only flowStrength bindings
remain unchanged. Scale never changes fixed translations; opacity derives from
the current animation baseline times the binding, not repeated multiplication.
Fixed art phase progresses along the existing release/capture curve after
settling; business conversion never determines speed.

The optional DEV-only `fiveACinematicReview=1` harness exposes
`window.__FIVEA_CINEMATIC_REVIEW__`. Its `applyFixture(kind,state,targetId)`
uses existing synthetic A3 LOW/HIGH, stage BALANCED/CONTRAST/PARTIAL and
transition LOW/HIGH/PARTIAL Snapshot factories. It validates through the real
consumer, Derived, VisualState, BindingPlan and adapters, then replaces the
Panel from that exact same consumer. No mesh numbers are written by evidence
scripts. Normal URLs do not force demo bindings or fetch new data sources.

Missing source fields, diagnostics and lineage remain in the Panel/report.
A safe fallback is never labelled as a real zero or a measured conversion.
The existing scene has a Core raycast, not five independently clickable stage
controls. No new picking loop or invented stage/flow interaction was added.

## Reproduction and evidence

Use installed project dependencies and Edge/Playwright via NODE_PATH.
`tools/fivea-v11-capture.cjs baseline|A|B` captures fixed-time PNGs and, unless
`FIVEA_CAPTURE_ONLY=1`, separate warmup + 60s steady + 60s pointer-motion samples
without screen capture. Its RAF wrapper observes the existing chain; it does
not schedule another one. Draw counts include postprocessing, not just FiveA.

`tools/fivea-v11-review.cjs` records real entry, live snapshots, Core click,
Panel wheel isolation/ESC, and complete return (routeIndex 0 and no transition).
It stores Snapshot, BindingPlan and actual uniform/alpha readbacks outside UI.
`tools/fivea-v11-tests.cjs` runs every current `src/**/*.test.mjs`, distinguishes
custom-harness named cases from Node wrapper cases, and preserves individual logs.
`tools/fivea-v11-evidence.py` assembles unchanged PNG pixels and a local gallery.
`FIVEA_LOSSLESS_VIDEO=1` captures native CDP PNG frames and original timestamps,
then encodes H.264 MP4 with explicit standard RGB-full → BT.709-limited conversion.
No brightness, exposure, local effect or speed filter is applied. MP4 is lossy;
the source PNG frames remain local. The first Playwright VP8 recording lost
subtle dark tones; it remains archived but is not the final review video.

All screenshots, recordings, proofs and test logs stay in `art/fivea-v11/`,
not Git. No Python asset generator, Blender or external asset was needed.

## Validation

**READY FOR HUMAN REVIEW — not HUMAN PASS, not production freeze.**

- All 41 current Node test files pass: **657 named cases**, 0 failures, 0 skips,
  **9 new** cases. Node runner reports 77 items because historical custom suites
  use file-level wrappers; these are not 77 assertions. The inventory suite's
  25 cases are counted, not misreported as its single Node wrapper.
- Production build and `git diff --check` PASS. Python evidence integrity/
  comparison assertions PASS; no affected Python asset pipeline exists in this
  change, so unrelated Earth/Galaxy generators/tests were not rerun.
- Native frozen HOME before/after is pixel-identical. Disabled FiveA matches
  original positions/camera; one pixel differs by one 8-bit code value. This is
  reported rather than called byte-identical or attributed to an unproven cause.
- Real GEO/FiveA/Brand Mind entry + complete return, both panels, all five
  scale/energy and four transition-alpha proofs PASS. Core click, Panel wheel
  isolation and ESC tested in the continuous recording. Console/runtime errors
  0; Canvas/primary RAF/window-document Wheel = 1/1/1. Existing pointer listener
  counts are unchanged; no second interaction loop was introduced.
- Same headed Edge 152 / ANGLE D3D11 / RTX 5060 Ti / driver 591.86. Desktop
  1920x1080 at 120Hz; test viewport 1600x900, DPR1, visible, normal VSync.
  Each measured block excludes a 10s warmup and all capture/recording activity.

| Variant / 60s+ block | Median | P95 | P99 | Max | >50 / >100ms |
|---|---:|---:|---:|---:|---:|
| Legacy steady | 8.3 | 8.5 | 8.5 | 8.7 | 0 / 0 |
| B steady | 8.3 | 8.5 | 8.5 | 8.7 | 0 / 0 |
| Legacy pointer movement | 8.3 | 8.5 | 8.5 | 8.6 | 0 / 0 |
| B pointer movement | 8.3 | 8.5 | 8.5 | 8.8 | 0 / 0 |
| Legacy snapshots + panel + wheel | 8.3 | 8.5 | 8.5 | 25.0 | 0 / 0 |
| B snapshots + panel + wheel | 8.3 | 8.5 | 8.5 | 25.0 | 0 / 0 |

Measured blocks are approximately 120 FPS. RAF intervals are frame pacing, NOT
GPU time. A separate timer-query probe (`tools/fivea-v11-gpu.cjs`) uses the
direct FiveA-only URL `?scene=fivea&v2FiveAState=balanced` (plus B for candidate),
not the complete HOME URL of the frame-pacing runs. Same viewport/DPR/Edge;
10s warmup, 15s sampling, 60 query samples per variant, zero disjoint samples.
Whole callback GPU median/P95/P99/max: legacy 2.730/4.058/4.159/4.179ms;
B 2.750/3.775/3.847/4.036ms. This includes Composer, not individual shader time;
do not combine it with the separate 60s frame-pacing population. Process-specific
VRAM was not collected. One board-wide
`nvidia-smi` observation was 1056 / 16311 MiB, including other apps; it is not a
process peak. FiveA owns six unchanged-size 768x128 label maps (~3 MiB RGBA+mips).
Total scene point count remains 7,704 (including Opportunity, orbit dust and
background); Stage 4,500 / Core 2,200 / Journey 432 are unchanged. Whole-frame
draw calls, including postprocessing, reduce 45→39 by hiding decorative orbit
lines; no new draw batch. Stage particles remain one GPU draw.

The final clip is about 24.16s, 1600x900, sourced from 565 timestamped PNG frames;
VFR capture rate is not the runtime FPS. Snapshot IDs and runtime readbacks are
in `review-report.json`. All six measurement blocks and failed early evidence
are kept local. An early return probe stopped when Hero first became visible;
the fixed probe waits for routeIndex=0 AND transitionTo cleared.

Remaining art review: the far A5 body and LOW-strength flows are intentionally
restrained; judge their visibility on the user's display. Bright packet heads
remain discrete point sprites, not volumetric filaments. No third correction,
next module or automatic integration is authorized.
