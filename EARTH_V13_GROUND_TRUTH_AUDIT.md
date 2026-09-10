# Earth V1.3 orbital ground-truth convergence — experimental

**EARTH ROUTE NOT READY / EARTH V1.3 NOT READY FOR PRODUCTION.**
Do not replace HOME FINAL V1. The exact-camera HOME improvement over 802f remains
incremental, despite improved weather transparency, coastline separation and motion.

## Safety and references

- Independent `feat/home-earth-realism-v13-ground-truth`, based on local de43f5e,
  which contains pushed 802f3f5 and HOME FINAL integration 42b33bf. Neither old node
  nor any old worktree/assets were changed. No merge, rebase, reset or force push.
- Reuse the four unchanged 4096x2048 lossless maps in `orbital-v12`, derived from
  Solar System Scope / INOVE CC BY 4.0 sources. Original attribution/manifest and
  hashes remain authoritative. Albedo sRGB; city, weather, normal/land linear.
- No new network images, generated city noise, runtime textures, geometry,
  renderer, compositor, route or data-panel changes. Old Earth URLs are unchanged.
- Runtime: append `earthOrbital=1&earthV13=1` to the frozen HOME query. Candidate B
  is default. Removing earthV13 retains the de43/V1.2 route; removing orbital
  retains frozen Earth. Geographic initial phase is unchanged.

## Ground truth and root cause

Blender **5.2.0 LTS**, Cycles / **OptiX RTX 5060 Ti**, 64 samples, 1600x900:
closeup 6.234s, HOME 4.419s. Only one reference pair was rendered. The exporter
copies actual Three.js sphere vertex/index/UV data, world matrices, camera and
solar direction into Blender. The reference is not a replacement image/plate.

The Cycles reference establishes rough land vs reflective water, thin weather
shadows and a visible dark hemisphere. It is a *material/lighting reference*, not
an absolute physical measurement or pixel-color truth: AgX differs from the
unchanged Web postprocessing, its specular glint is stronger than the desired art
direction, and the simple volume is not a spectral atmosphere simulation.

The HOME Earth is primarily **cropped**, not merely a reduced closeup. Its center
lies offscreen lower-left; the visible part predominantly shows the lit Asian
hemisphere. Many cities and night-body changes visible in closeup are outside
this crop. Global brightness and adding fake daylight cities would not fix this.
4K sampling still needs good filtering, but a blanket negative LOD or resolution
increase cannot solve the visible-region / material-response problem.

Four phases (0/90/180/270 degrees, land and cloud shifted together) were captured.
0 retained: recognizable coast/land/weather separation. The other phases mostly
present cloud or open ocean in the frozen crop. Camera, scale, position and sun
were not changed. Phase exploration was stopped after these four views.

## Material comparison and bounded correction

- A: restrained dry orbital air, 8 integration steps, stronger retained geological
  color; B: balanced weather / surface, 12 steps; C: softer deeper atmosphere,
  16 steps. **B selected**, then one correction to dark-side diffuse return and
  night cloud visibility. No second correction or follow-on version.
- Surface: true geographic albedo, rough terrain normal, subdued vegetation/
  mineral/ice response versus a separate near-black water BRDF. No displacement.
- City: preserve the same settlement / urban / hero channels and land exclusion.
  At genuine minification only, regional energy compensation is capped at 14%.
  Thin cloud optical transmission retains city geography; thick clouds attenuate
  it. No random lights or new city texture.
- Clouds: real low/mid/fine weather fields; nonlinear optical depth leaves thin
  cirrus transparent and thick systems coherent. Footprint-aware source sampling,
  weak geographic relief and solar-ray projected ground interaction. No embossing
  noise, screen-fixed texture or separate HOME material.
- Atmosphere: ground-clipped camera ray, Rayleigh/Mie-inspired single scattering,
  optical attenuation and bounded 10% apparent-height compensation from pixel
  footprint. 8/12/16 steps compared. B remains 12; this is not a fixed Fresnel ring.
- Motion: 3600-second rotation, clouds 1.11x. Real 10.005-second video measured
  **1.00074 degrees** surface rotation. No added RAF or interaction ownership.

## Engineering and GPU evidence

- All 37 current Node test files / 51 runner items PASS. Python visual 12 PASS
  (Earth 3, M3 display 4, source 3, HOME art 2). Build and diff check PASS.
- Actual Edge / ANGLE / NVIDIA RTX 5060 Ti: HOME **120.01 FPS**, P95 **8.5ms**,
  **53 draw calls**; closeup **120.01 FPS**, P95 **8.5ms**, **18 draw calls**.
  Earth stays **4 draws**; console/runtime 0, Canvas/RAF/Wheel 1/1/1.
- Whole-frame GPU query: HOME **3.245ms**, closeup **2.091ms** in this run.
- A separate per-Earth-mesh instrumented run at 12 steps measured summed means
  **1.147ms HOME / 1.215ms closeup**. These include timer/driver scheduling effects,
  exclude compositor and are not pure hardware shader cost. Do not infer that
  more steps are faster from noisy totals. All raw layer samples/means/P95 are
  preserved in `gpu-cost-report.json`.
- Full-frame Earth visible-hidden-visible subtraction was unstable in closeup
  (negative delta); it is **not valid as isolated Earth cost**. Raw data retained,
  not clamped into a fabricated positive result.
- Board VRAM **1315 MiB HOME / 1272 MiB closeup** of 16311 MiB, includes other
  applications, not dedicated process usage. Texture+mip estimate remains 170.7
  MiB; asset hashes unchanged. Performance captured separately from recording.
- GEO, FiveA, Brand Mind entry/return PASS; both Data Panels open/close PASS;
  all A1-A5 scale/energy and four transition flowStrength renderer proofs PASS.

## Review and stop decision

Evidence: `art/earth-v13/final/index.html` and PNG/video files, not committed.
Camera, Earth root scale/pose and viewport are asserted equal to the exact 802f
capture. Frozen/802f reference frames are copied unchanged from the preceding
baseline audit. Native HOME Earth ROI is `(0,490)-(445,900)`; NIGHT is an
unbrightened native closeup crop. Only SMALL_READ is resized. No retouching.

Native ROI shows a clear asset upgrade versus the old frozen 2K material, but
**V1.3 versus 802f is still chiefly cloud transparency and subdued surface color**.
At 640x360 the improvement is not the requested photographic step-change. The
night body remains subdued; the single-surface cloud approximation is not offline
weather volume. Therefore engineering PASS does not imply visual READY. Stop
this route; do not automatically continue another parameter round or change HOME
composition to force a pass. Save the reusable reference and opt-in experiment as
a local checkpoint explicitly marked NOT READY. No production promotion or push.

## Reproduction

Use Vite on 5186. The scripts reuse installed Edge/Playwright, Pillow/numpy,
Blender and FFmpeg. No new model dependencies.

1. `node tools/earth-v13-export-reference.cjs`
2. `blender --background --factory-startup --python tools/earth-v13-ground-truth.py -- --input art/earth-v13/ground-truth-1 --samples 64`
3. `node tools/earth-v13-gate.cjs --phases` (final code also applies V1.3 material;
   original phase evidence captured before material edits is preserved in art)
4. `node tools/earth-v13-gate.cjs --candidates`
5. `node tools/earth-v13-gate.cjs`
6. `node tools/earth-v13-gpu-cost.cjs`
7. `node tools/earth-v13-motion.cjs`
8. `python tools/earth-v13-evidence.py`

The gate intentionally requires an 802f camera report under baseline-802f. A new
checkout must supply that real baseline evidence; do not invent an A/B pose.
