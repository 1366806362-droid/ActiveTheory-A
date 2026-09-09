# Earth Hybrid Cinematic V1 — ready for human review

Independent candidate based on `7a8d71591e8fcab2ef4da62cb866a1e5c4694fb4`,
branch `feat/home-earth-hybrid-cinematic-v1`. Neither frozen HOME nor Master is
replaced. V1.2 and V1.3 references remain intact. This is a view-dependent Hero,
not a 360-degree Earth product and not an assertion of human visual approval.

## Ground truth and sources

Blender 5.2 / Cycles / RTX 5060 Ti OptiX. Three 1280x720, 48-sample candidates:
Deep Orbital Night A (1.428s), Balanced Cinematic B (1.100s), Near-Terminator C
(1.073s). B retains the actual HOME phase and sun; C's specular peak was rejected.
One final B render set, 2048x2048, 96 samples, OptiX denoise: Beauty 21.148s,
Surface 7.979s, City 2.456s, Body 7.680s, Cloud 3.259s, Atmosphere 3.879s;
46.401s total. No further Blender art correction.

The existing 4096x2048 Orbital V1.2 surface / land-normal / urban tiers / weather
maps are reused byte-for-byte. CC BY 4.0 Solar System Scope attribution remains
with the new derivatives. No downloads, generative API or new particle assets.
Separate transparent PNG + linear half-float EXR passes remain under local art.
AgX PNGs are reference displays; runtime loads linear EXRs, not display PNGs.
The offline volume reference has residual sampling noise at its extreme fringe;
it is not used as a baked runtime glow.

## Hybrid implementation

- Surface + City: one actual Earth-local curved mesh, 43,009 vertices / 85,632
  triangles. Quantized 16-bit ray distances against the identical undisplaced
  Blender sphere; no learned depth and no terrain displacement claim. 2048x2048
  PNG and little-endian depth binary retained. Max world quantization error
  0.0000591. Mesh/capture UV projection tested to 1e-6.
- Cloud: separate matching curved mesh, radius ratio 1.00249, front weather
  RGBA, associated alpha decoded once. Bounded slow UV drift fades to zero at
  the limb, so weather cannot drift off the disk.
- Atmosphere: the existing V1.3 real-time view/sun-sensitive atmosphere, no
  second renderer, composer, loop or pointer manager. No global exposure change.
- EXRs stay linear, mipmapped, anisotropy 4. Surface saturation is locally muted
  into silver/steel blue; City uses a sun-normal night mask. The existing final
  display transform is applied once, not baked into the source.
- Surface is capture-angle dependent. Within the existing tiny HOME movement
  it has real geometric parallax; beyond an 8-degree capture cone the retained
  real-time spheres are exposed. Loading failure also retains those spheres.
  Existing transforms and lifecycle are preserved.
- Closeup debug re-aims the captured cap for inspection. It is not a free-orbit
  test or a geographic same-angle closeup A/B. HOME A/B is the strict comparison.

## Visual judgment and evidence

Native Earth ROI `(0,470)-(460,900)` is compared without resize, sharpening or
post exposure: Frozen | 802f | V13 | Hybrid. HOME captures match the archived
802f camera, Earth position / scale / rotation and unchanged global exposure.
The Hybrid crop visibly separates weather, cloud shadows and land/ocean detail
more strongly than both 802f and V13. Frozen is softer and rim-dominated.
Earth still stays below the Galaxy's primary visual weight. This is an agent
review judgment, not HUMAN PASS; the user must decide whether it replaces Earth.

Small live mouse movement: Earth root moves about 7.2px versus Galaxy 1.6px.
Actual 10.316-second, 256-frame recording also tracks five visible depth points:
their differential motion is 9.0px, not one rigid 2D translation. Camera retains
its existing breathing. No observed coastline tear, limb hole or cloud escape;
out-of-cone fallback was separately exercised. Cloud time advances continuously.

Review gallery: `art/earth-hybrid/final/index.html`; full HOME, closeup, isolated,
depth/cloud/atmosphere, three parallax images, native ROI, three paired HOME
comparisons, offline references and actual runtime MP4. Art is not committed.

## Engineering and budgets

- HOME 120.0 FPS, P95 8.5ms; closeup 120.0 FPS. Earth 3 draws, HOME 52 (previous
  53), closeup 17. Canvas / RAF / Wheel = 1 / 1 / 1, console/runtime errors zero.
- HOME whole-frame timer sample ~3.25ms; visible/hidden/visible Earth delta
  ~0.13ms including downstream Bloom, not an exclusive mesh timer. Closeup GPU
  timer samples varied widely with clocks and are not used as a precise budget.
- Board VRAM 1725 / 16311MiB for HOME; includes other apps, not process allocation.
  Three 2K RGBA16F mip chains cost ~128MiB plus ~1.8MiB mesh, with fallback maps
  deliberately still resident. EXR transfer size is a candidate tradeoff; internet
  loading performance is not established by a local GPU gate.
- All 38 current Node test files / 56 runner cases PASS; 15 Python Earth/HOME/
  visual cases PASS; build and diff check PASS. Existing build chunk warnings
  are not new runtime errors.
- Real browser GEO / FiveA / Brand Mind entry and return, both Data Panels,
  all five scale/energy bindings and four flowStrength bindings PASS.

## Reproduction

Use existing `tools/earth-v13-export-reference.cjs` with `EARTH_REF_BASE` pointing
at the candidate Vite URL, `EARTH_REF_EXTRA=&earthV13=1`, and `EARTH_REF_OUT` set
to `art/earth-hybrid/input`. Capture is the actual mesh, camera, phase and sun.
Run Blender with `tools/earth-hybrid-render.py -- --preview`, then `-- --final B`.
Run `python tools/earth-hybrid-pack.py`. Existing V1.3 material helpers are reused,
not copied into a second system. Manifest records camera, precision and hashes.

Run `node tools/earth-hybrid-gate.cjs`, `node tools/earth-hybrid-motion.cjs` and
`python tools/earth-hybrid-review.py`. The gate defaults to port 5187 and reads
archived baseline evidence from `art/earth-hybrid/baselines/baseline-802f/`.
Node Playwright is supplied via the local bundled NODE_PATH. Missing archived
images must be restored from the user's existing art, not fabricated.

Candidate URL: existing HOME FINAL V1 flags plus
`earthOrbital=1&earthV13=1&earthHybrid=1`. Omitting `earthHybrid=1` keeps previous
runtime behavior. No default switch and no Master merge.

**EARTH HYBRID CINEMATIC V1 READY FOR HUMAN REVIEW.**
