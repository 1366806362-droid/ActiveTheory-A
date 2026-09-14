# FiveA Orbital — Luminous Particle Stars

**NOT READY — experimental candidate only, not HUMAN PASS or a shared-baseline freeze.**

## Scope and source

Independent `feat/fivea-orbital-particle-stars` from verified remote
`fa68f9bf3bfcc6bf3921dc8aae4c9b95c0f96b16`. Existing V1.2 orbits, clock,
stable IDs, Core interaction, Direct Entry, Panel and data contracts are retained.
`fiveAOrbital=B&fiveAParticleStars=B` opts into the new visual representation.
Without `fiveAParticleStars`, the original solid orbital candidate is unchanged;
without `fiveAOrbital`, the earlier FiveA path remains unchanged.
No HOME/Earth/Galaxy/GEO/Brand Mind assets or global postprocessing changed.

## Asset/material forensic conclusion

The V1.2 opaque sphere shader's macro/meso noise, veins, directional diffuse and
dark hemisphere dominated the picture. Its 3,300 detail points only decorated
that surface. The candidate removes this visible skin and uses one shared Points
batch containing 27,000 stable seeded 3D particles: 14,000 Core and 2,600 each
satellite. This is an art sampling budget, not population or density binding.
The old sphere geometry stays as the full-size CPU pick proxy. Its rendered
support is tiny, weakly emissive and depth-writing, not a rock surface.

Thirty-five percent of Core samples and 25% of satellite samples occupy the
interior; most others occupy a .72–1.00 radius thick shell, with 4% bounded
dust to radius 1.10. Nonuniform angular acceptance gives clumps and voids.
Local seeded rotations and very small bounded motion use the existing orbital
time; pause/resume therefore preserves both orbit and internal phase.

Same shared shader/batch, six matrix/energy slots keyed through the existing
stable-ID registry. Separate Stage energy values remain authoritative. The Core
stays art-only, never A6. Stage scale is applied once in each GPU matrix and
never changes orbit radius. No per-frame geometry/material/texture allocation.

## Light and depth

Linear RGB particle emission, sparse HDR highlights and front/interior/rear
weighting replace illumination by a fake directional light. The majority of
points remain low/mid energy. Output uses Three shader color/tone-mapping chunks
and the existing Composer OutputPass; no exposure or Bloom threshold/strength
changes. Existing `showBloom=0` supplies the matched comparison. No texture or
external asset was added. The six bodies remain legible with Bloom disabled.

All particles retain depth testing. Tiny inset supports provide central depth;
view-ray attenuation through other star volumes supplements it for particles,
tracks and flow. This prevents additive front/back whitening and rear-track
penetration without rendering a large invisible black depth disc. It is a
lightweight analytic volume approximation, not order-independent transparency
or a new rendering framework. Original flow alpha semantics remain intact;
geometric visibility only attenuates occluded portions.

## Two material corrections

Two initial directions shared the same particle distribution: A fine stardust,
B fine stardust with weak local flow modulation. B was selected from real
1600×900 views and native Core crops; neither was a solid-surface fallback.

1. First integration was too dim/subpixel, with tracks stronger than stars.
   Increased finite point coverage and sparse local emission, retaining alpha
   hierarchy and global postprocessing. The saved `MATERIAL_B.png` and
   `CORRECTION_1.png` show the same camera/Snapshot/time.
2. The Core still looked hollow. Redistributed existing samples inward, reducing
   the inset support radius. Total sample count did not change. No third art
   correction or orbit/layout exploration was performed.

Shader-chunk newline and fixture-kind issues were validation/implementation bugs,
fixed without changing visual direction or business semantics.

## Panel envelope fix

Instead of moving A5 alone, fit the complete local FiveA root into the actual
Panel-free region. A radius-3.10 bound covers every orbit, maximum authorized
scale, outer dust and label anchor lift. An additional 94px margin reserves
full label sprites and safety space. Perspective depth is included conservatively.
Only Panel-open or viewport changes recompute the fit; orbit phase and Snapshot
do not. Use the Panel's layout `offsetLeft`, not its animated translated rectangle.
Existing smooth presentation interpolation and global camera remain untouched.

At 1600×900 the Panel starts at x=546 and the local fit scale is approximately
.2148, centered within the remaining area. The opening leaves six recognizable
bodies and readable labels; the Panel remains primary. Main view scale .68,
orbit topology, camera and data scale are unchanged. The returned frame restores
the original local root. No mobile layout expansion was attempted.

## Reproduction and evidence

`tools/fivea-particle-stars-review.cjs prototype|capture|safety|home` uses headed
Edge. Safety covers 1366×768, 1600×900 and 1920×1080, real A3 LOW/HIGH and PARTIAL
Snapshots, plus maximum-scale envelopes over 750s in .5s samples. This includes
all individually reachable orbital phases; labels are bounded conservatively.
Native depth-phase screenshots and rapid Panel/ESC sequences supplement the
mathematical checks. It does not claim pixel-perfect transparency proof.

`tools/fivea-orbital-review.cjs video` reuses the existing real-time recorder,
with `FIVEA_ORBITAL_HOME`, `FIVEA_ORBITAL_EXTRA=&fiveAParticleStars=B` and
`FIVEA_ORBITAL_OUTPUT=art/fivea-particle-stars`. No accelerated playback or
post-brightening. CDP PNG timestamps are retained; MP4 is ordinary lossy H.264.

`tools/fivea-particle-stars-evidence.py` assembles before/after, Bloom and data
comparisons without changing captured pixels. Overview 1600×900 native PNG;
Core 320×320 and satellite 180×180 native crops; Small Read 640×360 derivative.
All images, video, reports and cache remain in local untracked `art/`.

Final performance, regression and review decision are recorded below after
measurements; tests and framerate never substitute for human approval.

## Final visual decision and regression

The six spherical envelopes and particle granularity now read clearly; the
solid-planet surface is gone. Bloom-off preserves the complete bodies. Small
Read still reads more as dense tiny points than sufficiently cohesive luminous
stars. The central integration has improved, but the user's overall energy
target is not yet convincingly met. **NOT READY** after two material corrections;
preserve the useful representation and Panel fix, without a third art iteration.
Core disk pixels above RGB 245 in all channels were 0% in the fixed comparison,
but absence of clipping is not proof of successful luminosity. The new Core's
mean RGB is lower than the solid reference: bright specks do not by themselves
establish a stronger integrated energy impression.

A5 Panel clipping is closed within tested desktop bounds: 9 layout/data runs
(3 viewports × real A3 LOW/HIGH/PARTIAL), 750s/.5s maximum-scale envelope samples,
zero body/label exits. Minimum margins 37.5 / 47.2 / 103.2px. Actual phase frames,
6 rapid open/ESC cycles and real-time pause/resume all pass. Bounds are conservative
geometry checks, not a claim of perfect pixel-level occlusion across all time.

43 Node test files / 680 named cases, 13 new, 0 failures/skips; 100 Node wrapper
items are not the case count. Build and diff check PASS. Python evidence integrity
and before/after HOME pixel identity PASS; no unrelated asset generators rerun.
Real GEO/FiveA/Brand Mind entry/return, both Panels, five-stage and four-flow
renderer proofs PASS; console/runtime 0, Canvas/RAF/Wheel 1/1/1. Validation-only
visibility/focus listeners in the separate performance harness are not app loops.

Normal browser recording: 1,283 native CDP PNG frames, 51.316s source timestamp
span, with over 32s unaccelerated orbital movement, data changes, real Core click,
Panel pause, button/ESC close, return, reentry and return. Movie capture cadence
is approximately 25 FPS, not the application's uncaptured frame rate.

## Performance — include the anomalous run, do not cherry-pick

RTX 5060 Ti / driver 591.86, headed Edge 152 / ANGLE D3D11, desktop 120Hz,
1600×900 DPR1. Ten-second excluded warmup; each measurement window is 60s with
no screenshots or recording. The standard harness records a separate clip only
after timing ends. No DPR, quality or global lighting changes between versions.

| Run | Median / P95 / P99 / max ms | >50 / >100ms | Draw calls |
| --- | --- | --- | --- |
| Solid steady | 8.3 / 8.4 / 8.5 / 8.6 | 0 / 0 | 30 |
| Solid pointer | 8.3 / 8.4 / 8.5 / 8.9 | 0 / 0 | 30 |
| Solid Snapshot / Panel | 8.3 / 8.4 / 8.5 / 25 | 0 / 0 | 30 |
| Particle initial steady | 8.3 / 8.4 / 8.5 / 1008.5 | 26 / 26 | 30 |
| Particle initial pointer | 1008.2 / 1008.4 / 1008.4 / 1008.4 | 60 / 60 | 30 |
| Particle independent Snapshot / Panel | 8.3 / 8.4 / 8.5 / 25 | 0 / 0 | 30 |
| Particle focus-instrumented steady repeat | 8.3 / 8.4 / 8.5 / 8.6 | 0 / 0 | 30 |
| Particle focus-instrumented pointer repeat | 8.3 / 8.4 / 8.5 / 8.6 | 0 / 0 | 30 |

The anomalous steady run delivered 4,163 frames in 60.677s (approximately
68.6 FPS), then 60 frames in 60.461s (approximately 1 FPS). A low frame-count
P95 masks these long stalls: it is NOT a performance pass. Original artifacts
remain in `performance/particle/`. The independent Panel sample and explicit
`bringToFront()` repeat reached approximately 120 FPS. The repeat logged
`visibility=visible`, `focused=true`, no visibility/focus changes and no long
frames. The original sample had no continuous focus log. Therefore the stall
was **not reproduced but its cause is unproven**; do not assert host/browser
throttling as a diagnosed cause or claim it was fixed by the material.

Separate EXT_disjoint_timer_query_webgl2 measurements, entire main rendering
callback including Composer, 60 samples over 15s after 10s warmup, no disjoint:

| GPU query | Median | P95 | P99 | Max |
| --- | --- | --- | --- | --- |
| Solid | 2.916ms | 3.496ms | 3.772ms | 4.037ms |
| Particle | 3.025ms | 3.958ms | 4.116ms | 4.171ms |

Actual particle geometry: 27,000 star samples + 432 existing flow + 260 background
= **27,692** total. Six existing sphere support draws, one star batch, one five-
track batch, one four-flow batch; total measured frame draws remain 30.
Star attribute buffers total 756,000 bytes, no additional texture. Board-wide
nvidia-smi observation 1,398 / 16,311 MiB includes all applications; it is not
per-process VRAM or peak usage. No claim of GPU timing from RAF intervals.

Save as an explicitly NOT READY experimental checkpoint. The local Panel fix
and particle representation are useful, but art energy integration still needs
user-approved follow-up; initial frame scheduling anomaly remains on record.
