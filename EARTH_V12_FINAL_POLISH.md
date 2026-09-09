# Earth V1.2 Final Realism Polish — NOT READY FOR PRODUCTION

## Safety / scope

Base `802f3f560ac788f822d8e89ce756d7715660f2c7` on
`feat/home-earth-realism-v12-orbital`. The base is retained in Git and was captured
again in real Edge before editing. All four runtime asset hashes still match its
manifest. No new downloads, texture generation, Blender, renderer/composer changes,
Camera, route, layout, V2 or business-scene changes. Frozen HOME remains unchanged
without `earthOrbital=1`. Master is not merged or modified.

## Actual defects addressed

- The city shader used a nearly linear cloud multiplier. The final experiment
  uses geographic settlement/urban/metro channels, separate response curves and
  Beer-like slant transmission: clear = 1, thin cloud mostly transmits, thick
  cloud strongly attenuates. Land masking and night gating remain mandatory.
- Fixed shadow UV displacement ignored the view/sun orientation. Thin-cloud
  ray projection now uses local sphere tangents and existing relative rotation.
- Cloud density alone was insufficient for depth. Existing weather/mid channels
  provide body and a stable source residual breaks edges; four neighboring mid
  samples provide restrained normals. Two sunward samples approximate occlusion.
- Atmosphere retains eight bounded ground-clipped steps, with boundary-concentrated
  cosine bins and a darker backlit arc. No added shell, LUT, draw or global exposure.
- Night land gains weak region-dependent sky return; the darkest region still
  approaches black. Ocean has a smooth local specular shoulder instead of a
  hard-clipped highlight. This is an art-directed real-time approximation, not
  a quantitative atmospheric or population simulation.

## Candidates / correction limit

Three strategies: A thin/dry urban contrast, B balanced weather relief, C more
diffuse atmospheric night. B selected using both 1600x900 closeup and HOME.

1. Corrected insufficient night-land response, hard water highlight and weak
   mid-scale cloud relief.
2. Softened excessive cloud embossing with a continuous relief shoulder.

No third correction, asset reconstruction or composition adjustment was made.

## Visual decision

**NOT READY** for the requested final HOME-scale realism milestone.
City belts and metropolitan hierarchy are more legible in closeup, cloud material
has more depth and dark land is slightly more discoverable. However the strict
same-camera HOME A/B is still too similar. Much of the initial visible crop is
sun-facing weather/terrain; the improved dark-side urban hierarchy is mostly
outside that crop. This does not justify forcing night lights onto daytime ocean
or changing the approved camera, Earth orientation or composition.

Night terrain also remains display-dependent. This result should not be described
as a new human-approved photographic Earth, or silently replace the 802f baseline.
Retain the experiment and evidence, stop here, and require a new explicit direction.

## Engineering evidence

All 36 current Node test files: 47 runner cases PASS (including eight orbital
tests). Twelve Python visual/asset tests PASS, build and diff check PASS.
Browser report verifies GEO/FiveA/Brand Mind entry/return, both panels, A1-A5
scale/energy and four flowStrength renderer bindings; fixtures remain MOCK.
Console/runtime zero; Canvas/RAF/Wheel 1/1/1.

Real Edge / NVIDIA RTX 5060 Ti / 1600x900 DPR1, no video recording during timings:

| View | FPS | P95 frame | GPU whole-frame | Total draws | Earth draws | Board VRAM |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| HOME | 120.02 | 8.5ms | 3.29ms | 53 | 4 | 1201 / 16311MiB |
| Closeup | 120.01 | 8.5ms | 1.34ms | 18 | 4 | 1153 / 16311MiB |

GPU elapsed is whole frame, not isolated Earth cost. Board VRAM includes all apps.
Live parallax keeps near Earth displacement greater than distant Galaxy.
No new frame-random noise, listener or animation loop; existing sampling/mips,
4K maps, shell radii, rotation and relative cloud speed are preserved.

## Reproduction / evidence

Capture the unmodified 802f worktree with `tools/earth-orbital-v12-gate.cjs`,
`EARTH_GATE_OUT=art/earth-v12-final/baseline-802f`, on the actual server URL.
Preserve that baseline report/images before running the modified worktree.
`tools/earth-orbital-final-gate.cjs --candidates` captures the three strategies.
Without the option it captures B and layers, using the exact saved 802f camera
pose and frozen Earth phase. Camera pinning is screenshot-only; performance and
parallax use the ordinary live camera. No runtime camera source is changed.

`tools/earth-orbital-final-evidence.py` builds ungraded native-resolution A/B,
640x360 small read, and a native 480x480 night crop. It never lifts shadows.
`tools/earth-orbital-final-motion.cjs` records real unfrozen closeup motion.
`tools/home-final-art-regression.cjs` retains the existing interaction proof.
All PNG/video/reports remain local under `art/earth-v12-final/`; gallery:
`art/earth-v12-final/final/index.html`. These are experiment evidence, not production
assets. Only source/tests/reproducible tools and this status belong in a checkpoint.
