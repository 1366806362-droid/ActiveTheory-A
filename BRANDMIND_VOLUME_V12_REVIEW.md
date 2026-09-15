# Brand Mind V1.2 — single-Core experiment, NOT READY

## Safe origin and scope

Shared baseline at fetch: `58259cf5d173110221145104b9c9dcacbbe5595d`.
Feature starts from V1.1 `85d6a0bffa04ee743c770b4241f049e88e510f14`, which
contains that shared baseline and the HOME default promotion. Original worktrees,
V1.1 code path, frozen Brand Mind and all HOME/FiveA/GEO/Earth assets remain.
No shared branch merge or default promotion.

Candidate: `/?scene=brandmind&brandMindVolumeV12=1` (retained B, 40 steps).
Explicit A/B and `brandMindVolumeSteps=24` permit reproduction. Missing or `=0`
retains the existing default. `brandMindCognitiveV11=1` still reproduces V1.1.
The candidate defaults to **Core-only**, with old wire nucleus and wide membrane
geometry not created, and peripheral visual batches hidden. `brandMindVolumeOnly=0`
is only an unvalidated inspection of inherited peripherals, not an integrated V1.2.
`brandMindVolumeReview=1` exposes existing DEV capture controls; no new UI/loop.

## Actual implementation

- One proxy box, scaled to object-space ellipsoid axes `[.58,.69,.50]` with a
  small tilt. Camera transformed into the same local coordinates as the density.
- Analytic ray/sphere entry and exit, 24 or 40 midpoint samples along that exact
  interval. Extinction includes the step length: `1-exp(-rho*sigma*ds)`.
  Front-to-back transmission weights emissive source-function contributions.
- A: smooth asymmetric bulk with broad density modulation and an offset light.
  B: two broad intersecting/wrapping media inside the same coherent envelope.
  B's initial smooth preflight was retained locally before this structural change.
- Internal pearl/ice source, medium extinction and thin view-dependent contour
  contribution. No physical brain model, refraction, multiple scattering,
  environment-map transmission, or claimed physically accurate cognition.
- Straight alpha / NormalBlending, not uncontrolled additive accumulation. The
  accumulated radiance is divided by accumulated alpha once before blending.
  Installed Three r185 renders this linear into Composer; existing OutputPass
  applies ACES and display transfer. No global exposure/Bloom edits.
- No density texture, additional RenderTarget, renderer, composer or RAF. Core
  proxy vertex/index attributes total approximately 840 bytes before driver
  overhead. No new Core particles. The retained scene still allocates 1,468 old
  peripheral particles, but these are hidden in this isolated gate.
- Existing Core click identity and same-parent ellipsoid pick proxy are retained;
  decorative volume bounds are not used as an oversized clickable halo. Panel
  APIs/ESC/return remain; local time also pauses on hidden tabs and reduced motion.

## Single-Core gate: failed, stopped before integration

A reads as a soft white light inside a blue envelope. B establishes continuous
ovoid mass and visible attenuation, but its medium still reads too murky/solid,
with insufficient distinct internal depth and luminous structure. It does not
meet the translucent-energy-sculpture brief. More samples do not solve this.

**NOT READY FOR PRODUCTION.** Following the user's single-Core stop rule, no
peripheral node/background/Halo upgrade or Panel art adaptation was pursued.
No complete scene visual acceptance, final 30–45s interaction video, 10-cycle
final lifecycle gate, or formal 60s steady/interaction acceptance is claimed.
The integration-stage correction budget was not entered.

Six inherited objects are **art IDs**, not six canonical business associations.
Three inherited paths retain their visual endpoint keys. Canonical mapping remains
`NEEDS_STABLE_REGISTRY_HOOK`; the Panel's two mock associations were not changed.

## Diagnostic evidence and cost

`tools/brandmind-volume-gate.cjs`: default captures A/B at 24/40 steps;
`diagnostics` captures native 1600x900 DPR1 Core-only, V1.1 same-camera/time Before,
volume/contour split, and Bloom OFF/ON; `cost` samples the installed GPU directly.
`tools/brandmind-volume-evidence.py` builds ungraded comparison sheets and Small
Read. Evidence is under untracked `art/brandmind-v12/`, not used by runtime.

Fixed V1.1 Before differs from the prior checkpoint capture by at most one 8-bit
code value; RGB mean errors are 0.0018/0.0058/0.0180. Do not call it bit-identical.
B24/B40 Core-region RGB mean differences are 0.0604/0.0557/0.0438 code values.
The proxy's screen bounding rectangle covers 13.76% of 1600x900; actual sphere
intersection/discard further limits useful raymarching. This is not a fullscreen pass.

Edge 153 / RTX 5060 Ti, 1600x900 DPR1, visible foreground, approximately 120Hz.
Each technical sample uses 5s warmup and 10s capture-free observation:

| Mode | FPS | P95 / P99 / max ms | >50 / >100 ms | Total draws | GPU median / P95 ms |
|---|---:|---|---|---:|---|
| V1.1 Before | 120.01 | 8.4 / 8.5 / 8.6 | 0 / 0 | 23 | 2.831 / 4.003 |
| B24 Core only | 120.01 | 8.5 / 8.5 / 8.6 | 0 / 0 | 16 | 2.768 / 3.914 |
| B40 Core only | 120.01 | 8.5 / 8.5 / 8.6 | 0 / 0 | 16 | 2.753 / 3.966 |
| Core hidden | 120.01 | 8.5 / 8.5 / 8.6 | 0 / 0 | 15 | 2.787 / 3.968 |

Whole-frame medians are within run-to-run variation; their subtraction is NOT
a valid negative Core cost. A separate non-nested GPU query bracketing the Core
draw measured median/P95 **0.1061/0.1108ms**, 601 valid samples. RAF median 8.3ms
is frame cadence, not GPU time. No 60s performance acceptance is claimed.

Full source tests: 48 files / 134 runner tests / 714 actual cases, 0 failed/skipped,
10 new. Related Python 6 passed. Build/diff check passed; existing bundle warning
retained. Browser smoke results are recorded separately from the failed art gate.
