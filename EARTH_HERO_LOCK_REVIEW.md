# Earth Hybrid Hero Lock V1 — candidate review

2026-09-10, HOME / RTX 5060 Ti 16GB. Independent branch
`feat/home-earth-hybrid-hero-lock`, based on protected `9790a8e` (including
`a4880f3` Hybrid and `42b33bf` integrated HOME/bindings). No Master merge.

**READY FOR HUMAN REVIEW**, not a new human visual approval. No texture,
material, shader, renderer, global camera, route, panel or other Home art edits.
The historical handoff experiment remains NOT READY on its own branch.

## Selected interaction

Opt-in: add `earthOrbital=1&earthV13=1&earthHybrid=1&earthHybridProd=1&earthHeroLock=1`
to the frozen HOME FINAL V1 URL. Without the new flag, the inherited path is unchanged.

- **B / balanced perceptual depth**: `tanh(1.8 * input)` and analytic critical
  damping, omega 24/s. Compared against A translation-led / exponential and C
  orientation-led / piecewise C1. B retains enough limb/material change without
  making rotation the main depth cue. No scale animation or screen-space sprite.
- At 900 CSS-pixel height, translation reference amplitudes are 20px X / 10px Y;
  actual full pointer edge saturates around 18.94px / 9.47px. The small +/-0.1
  pointer example spans 7.12px horizontally. Values scale with viewport height.
- Local orientation amplitude .65 degrees Y / .2925 X; actual corner about
  .615 / .277 degrees. Cloud differential amplitude .035 degrees, measured .033.
- A read-only neutral camera removes **only** the frozen pointer terms, then
  unprojects the desired screen displacement into an Earth-only 3D child transform.
  Global camera idle, composition and every other object's motion remain live.
- The existing surface draw's `onBeforeRender` applies the late transform after
  the final camera is known. No second renderer, RAF, pointer manager or wheel.
  A foreign camera position, quaternion, FOV or departing Hero scale bypasses it.
- Surface phase approaches a bounded 2.2-degree drift; clouds retain a tiny
  independent .16-degree, ~220-second breathing drift indefinitely. One inherited
  update clock drives surface, cloud, atmosphere and handoff. A session snapshot
  preserves phases/spring state across disposal/recreation; inactive HOME pauses
  its clock as before. Full document reload is a new application session.

## Safe region and fallback

0/2/4/6/8/10-degree local-root sweep captured with Hybrid forced for inspection.
Measured view angles were .11/1.83/3.74/5.66/7.58/9.50 degrees. The low-angle
region retained clean limb/cloud integration; the upper sweep consumes captured
view margin. Use **4 degrees as the conservative reviewed region**, not a target.
Normal stress peaked at 1.68 degrees; one-hour phase plus corners at 2.32 degrees.

Inherited 6..14-degree safety handoff / .25-degree angular hysteresis is unchanged.
Forced 15..19-degree measured views reached full fallback and returned to Hybrid.
Normal interaction never entered that band. The full fallback still looks less
photographic; it is not a normal interaction quality solution.

Fallback already executes within the same warmed surface/cloud shader programs.
33 total scene programs remained constant through extreme handoff; no new compile
or material creation on transition. Seven unique active Earth textures are shared:
four 4096x2048 runtime maps and three 2048x2048 captures, no duplicated 4K set.
Earth remains 3 draws; failure to load the capture manifest safely retains the
original 4-draw realtime Earth. Injected network failure is reported separately,
not concealed in normal console error counts.

## Validation and honest performance limits

- Latest 61.0155-second stress: 14,569 frames, fallback triggers/frames 0,
  nonfinite values 0, max view 1.6785 degrees, local input offset max 20.88px.
- 238.78 FPS average, CPU render callback 1.33ms, GPU frame 2.54ms;
  P95/P99 4.3/4.3ms. **Worst frame 129.8ms is retained**, near the initial
  120-to-240Hz pacing change. No JS long task was reported and programs stayed 33;
  its exact cause is not proven. An earlier run had 146.9ms; a repeat had 4.8ms max.
  Do not advertise these results as a universal zero-stutter guarantee.
- Final slow/fast/natural video runs: ~240 FPS, worst frames 4.4/4.5/4.5ms,
  fallback 0. Render cadence varies with this host; this is not a claimed 2x
  optimization over the historical 120 FPS baseline. MP4 recording is 25fps.
- Earth-visible/hidden/visible GPU estimate: +.256ms, including downstream bloom;
  not an exclusive mesh timer. Neutral HOME 52 draws; existing nebula hover can
  temporarily add draws (~53 in motion). Earth always 3 in normal mode.
- Board VRAM around 2.7..3.0GiB of 16GiB: entire desktop, not Earth-only allocation.
- 1366x768,1600x900,1920x1080,2560x1440,3440x1440 and DPR 1/1.25/1.5/2:
  no fallback or nonfinite transform; responsive silhouette and limb retained.
- Real same-window native Edge tab visibility: visible -> hidden (1534ms) ->
  visible, phase continuous. Playwright's ordinary focus emulation could not
  prove this, so the dedicated default-context CDP gate avoids it. Native Edge
  startup/auxiliary tabs are identified explicitly rather than picking pages[0].
- Real engine recreation, one-hour phase, pointer leave/reentry, all three entries
  and returns preserve state. GEO / FiveA / Brand Mind returned to HERO_START;
  both panels, all five stage bindings and four transition flow bindings pass.
- Node 68/68, Python visual 15/15, build and diff checks pass. Normal runtime /
  console errors 0, Canvas/RAF/wheel 1/1/1. No asset or Blender work.

## Evidence and reproduction

All images/reports/videos stay local under `art/earth-hero-lock/`; none belong
in the checkpoint. Final gallery: `art/earth-hero-lock/final/index.html`.
It includes HOME, ROI, center/edge/corner, cloud/atmosphere crops, candidate and
motion contacts, response plot, safe-range sweep and three real-input videos.
No relighting or asset image edits were used to make evidence look better.

```
node tools/earth-hero-lock-gate.cjs
node tools/earth-hero-lock-validation.cjs candidates
node tools/earth-hero-lock-validation.cjs stress
node tools/earth-hero-lock-validation.cjs responsive
node tools/earth-hero-lock-validation.cjs safety
node tools/earth-hero-lock-validation.cjs lifecycle
node tools/earth-hero-lock-validation.cjs asset-failure
node tools/earth-hero-lock-visibility.cjs
node tools/earth-hero-lock-validation.cjs videos
node tools/earth-hero-lock-validation.cjs final
python tools/earth_hero_lock_evidence.py
```

`EARTH_LOCK_BASE` overrides the default 5189 URL. Playwright/Edge and FFmpeg are
existing host dependencies. Native visibility briefly creates its own visible
test window/profile, then closes that owned browser; user browsers are untouched.
The [CDP Target contract](https://chromedevtools.github.io/devtools-protocol/tot/Target/)
defines the separate window/tab creation and target activation used by that gate.

Run `tools/home-final-art-regression.cjs` with `HOME_REGRESSION_URL` set to the
complete Hero Lock URL and `HOME_REGRESSION_OUTPUT=art/earth-hero-lock/regression`.
It now additionally records Earth phase before/after each existing entry only
when the Hero Lock URL flag is present. The normal regression behavior is unchanged.

No follow-on Earth material work is authorized by this candidate. Human review
should focus on weight, smooth stop/reversal, near/far depth and cloud attachment.
