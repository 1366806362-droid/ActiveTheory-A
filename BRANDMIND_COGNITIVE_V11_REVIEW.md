# Brand Mind Cognitive Memory V1.1 — experimental, NOT READY

Base: `58259cf5d173110221145104b9c9dcacbbe5595d` (latest shared baseline at task start).
Includes HOME default promotion `247efad8ae3ede47b586aee0ab21a5097e92a9c1`.
Work is isolated on `feat/brandmind-cognitive-memory-v11`; no shared-branch promotion.

## Entry and fallback

- `/?scene=brandmind&brandMindCognitiveV11=1` selects retained candidate B.
- `brandMindCognitiveV11=B` explicitly selects B; `=A` retains Cognitive Lens.
- No flag, `=0`, or an unknown value retains the unchanged original Brand Mind.
- `brandMindCognitiveBackground=0` disables only the candidate environment.
- `brandMindCognitiveReview=1` exposes DEV-only time/background evidence controls.
  It is not a business-data binding, production control panel, or second loop.
- Default HOME, Earth Hero Lock, Galaxy, FiveA and GEO are unchanged.

## Two candidates and two corrections — stopped

A (Cognitive Lens) uses shallower open sheets and a quieter, wider constellation.
B (Memory Bloom) uses uneven depth-oriented membranes and a closer constellation.
B was retained because A's layered arcs looked more like astronomical rings.
Camera position, quaternion and FOV remain exactly the baseline. Node art spacing
is explicitly different: B uses original X * 0.88 and Y * 0.81; original Z remains.
Before/after is therefore a same-camera scene comparison, not a shader-only claim.

1. Correction 1: hard-cut sheet gaps, parallel strands and oversized sprites looked
   mechanical/bokeh-like. Replaced cuts with soft alpha gaps, folded variable-width
   membranes and smaller irregular knots. Evidence: `CORRECTION_1*.png`.
2. Correction 2: nucleus was too dispersed. Organized its existing particles into
   four incomplete overlapping sheets and strengthened sparse fiber packets without
   adding paths/particles. This improved cohesion but left a visibly wiry nucleus.

Final self-review: **NOT READY FOR PRODUCTION**. Core is identifiable and distinct
from FiveA; near/mid/far knots exist, but the nucleus still reads as a thin scribble,
the void/cloud depth is too weak, and fibers/associations lose readability at Panel
scale. No further artistic correction is authorized in this milestone. This is not
HUMAN PASS, a freeze, or an instruction to replace default Brand Mind.

## Registry truth, not invented business identity

The actual baseline had six historical visual objects and three visual paths;
its renderer inventory explicitly marked the canonical association mapping
`NEEDS_STABLE_REGISTRY_HOOK`. Panel fixtures currently contain two business
associations and one relationship. These are not interchangeable counts.

The candidate consumes the existing visual definitions by explicit historical
object names, exposes read-only `resolveVisualNode(visualId)` and
`resolveVisualPath(sourceVisualId, targetVisualId)`, and leaves `associationId`
unset. Reordering input definitions preserves ID lookup/positions/endpoints.
No mock association is guessed from an array slot, no new canonical mapping is
claimed, and no business relationship is invented. The canonical hook remains
future engineering work, clearly separate from this art experiment.

## Implementation and interaction

- One shared GPU knot batch; one nucleus/shell particle batch; one four-sheet
  membrane mesh; one three-path fiber batch; three broken halo depth bands in one
  batch; sparse far particles and one low-frequency local cloud plane.
- 3,988 displayed particles (not people/mentions): core 1,800, knots 960,
  halo 720, far layer 220, fibers 288. No downloaded or generated bitmap assets.
- Slow independent-phase local animation; no synchronized scale breathing or
  planet orbits. Existing scene update drives everything; no added listener/RAF.
- Core-only pick proxy follows the root; outer halo is not clickable. Panel uses
  the existing API, adapts only the local scene into remaining space, pauses local
  time, and resumes without restart. Reduced motion holds the current phase.
- Global camera, exposure/Bloom settings, Canonical/Derived, Panels and adapters
  are not edited. Original scene exposure contribution is retained exactly.

## Evidence and reproducibility

Native 1600x900 DPR1 PNG capture, same baseline camera, t=12; comparison sheets
retain full-size images with a 28px caption strip. Core/node/flow details are native
pixel crops. Small Read is a disclosed 640x360 downsample. No grading/sharpening.

`tools/brandmind-cognitive-review.cjs` modes: baseline, candidates, final, qa,
environment, perf, video, baseline-motion. Requires the existing local Playwright
and Edge validation environment; ffmpeg only for the optional recorded evidence.
URL may be provided through `BRANDMIND_URL`. No hard-coded user/worktree path.
`tools/brandmind-cognitive-evidence.py` assembles evidence with existing Pillow.

All captures, JSON reports, videos and gallery are local and untracked under
`art/brandmind-v11/`; none are runtime resources. `art/` and Python caches are not
part of the checkpoint. Performance and regression results are in PROJECT_STATE.
