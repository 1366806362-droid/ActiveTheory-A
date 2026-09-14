# FiveA Centered Energy Particle Stars V1.3 Review

## Status

- Branch: `feat/fivea-orbital-energy-stars-v13`
- Verified base: `1cc1693cc70bc491ca5ce53757b849b546de6325`
- Result: **READY FOR HUMAN REVIEW** — not HUMAN PASS and not a production freeze.
- Opt-in query: `fiveAOrbital=B&fiveAParticleStars=B&fiveAEnergyStars=A&scene=fivea`.
- The previous particle-star path remains unchanged when `fiveAEnergyStars` is absent.

## Selected visual structure

Candidate A was selected over B in the real FiveA overview. It uses one shared
GPU `Points` batch for the main Core and all five satellites. Deterministic
sampling organizes every body into four radial roles:

1. compact luminous core;
2. structured mid-energy field;
3. sparse readable spherical shell;
4. restrained outer dust.

Clumps, local voids, depth response and rare hero particles replace the prior
uniformly dense white-noise distribution. Two evidence-based corrections were
used: first to recover satellite shell readability, then to reduce satellite
core dominance while lifting the mid/shell layers. No global exposure, Bloom,
orbit geometry, camera or label changes were made.

## Particle budgets

| Path | Main Core | Per satellite | Total |
| --- | ---: | ---: | ---: |
| Existing particle stars | 14,000 | 2,600 | 27,000 |
| Candidate A | 8,000 | 1,350 | 14,750 |
| Candidate B | 7,000 | 1,100 | 12,500 |

Candidate A therefore reduces the visible particle budget by 45.4% while
preserving one particle draw call and the existing six body transforms.

## Binding and interaction preservation

- The real stable IDs remain exactly `A1` through `A5`; Opportunity stays
  separate and Core remains the existing Panel entry.
- Existing stage `scale` and `energy` and the four adjacent `flowStrength`
  channels remain the only authorized renderer bindings consumed here.
- Repeated Snapshot application remains baseline-relative; no per-frame
  business derivation or accumulated scale/energy multiplication was added.
- Orbit pose, phase, radii, labels, transition paths, click targets, Panel
  pause/resume, ESC, direct return and HOME handoff are unchanged.
- A5 body and label envelopes pass at 1366x768, 1600x900 and 1920x1080 over
  five representative orbital phases. The smallest measured margin is 16.32px.

## Runtime and performance evidence

Environment: headed Edge 153, NVIDIA RTX 5060 Ti, 1600x900, DPR1, visible and
focused 120Hz window. These are separate 60-second samples after warm-up:

| Sample | Median | P95 | P99 | Max | >50ms | >100ms | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Steady | 8.3ms | 8.5ms | 8.5ms | 8.6ms | 0 | 0 | 30 |
| Pointer interaction | 8.3ms | 8.5ms | 8.5ms | 8.9ms | 0 | 0 | 30 |
| Snapshot + Panel | 8.3ms | 8.5ms | 8.5ms | 25.0ms | 0 | 0 | 30 |

`EXT_disjoint_timer_query_webgl2` measured the entire main render callback,
including the existing Composer: median 2.784ms, P95 3.911ms, P99 4.015ms,
max 4.089ms. This is not an isolated shader timing. Canvas / RAF / wheel are
1 / 1 / 1 and the browser validation reported no console/runtime errors.

## Verification

- Complete Node run: 43 test files represented by 101 Node runner tests,
  all passing; the candidate adds one focused four-zone material test.
- Python Earth regression: 6/6 passing.
- `npm run build`: passing.
- `git diff --check`: passing.
- HOME GEO, FiveA and Brand Mind entry/return, both Panels, five stage bindings
  and four transition bindings: passing in the existing browser regression.

## Local review evidence

Native screenshots, runtime MP4 and machine-readable reports remain local and
untracked in `art/fivea-energy-stars/`. The MP4 is a real browser recording;
it covers orbit motion, stage and flow data changes, Panel pause/resume, return,
re-entry and second return without post-production speed changes.
