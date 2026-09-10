# Earth Hero Lock input forensic audit — 2026-09-10

Baseline: `9790a8e955dd622ff6a5c770f8c03834c5b2d48d`, independent Hero Lock worktree.
No runtime source had been modified when this audit was captured. Native Edge,
1600x900 DPR1, actual application pointer events, 3.5 seconds settle per sample.
Earth's own rotation was frozen by its existing audit flag; global camera and
Universe idle motion remained live. Full data: `art/earth-hero-lock/input-audit.json`.

## Actual chain

`interaction.js` maps client x/y to [-1,1], with y upward. Target -> filtered
input uses exp damping 5.5/s; filtered input -> parallax uses 1.15/s. Existing
camera offsets are x=.16*parallaxX, y=.065*parallaxY, z=.085*strength;
look target offsets x=.075*parallaxX, y=.045*parallaxY. Universe root adds
x=.04*parallaxX, y=.025*parallaxY. No pointer-driven Earth-local rotation exists.

CameraEmotion additionally changes camera position, target and dolly with time;
the Universe adds sin(time*.008)*.008 radians of Y rotation. These are not pointer
responses and must not be misreported as such. Hybrid angle uses the actual
camera in Earth-local coordinates, including bounded surface/cloud phase drift.

| Input | Earth center px | Galaxy center px | Hybrid view degrees |
|---|---|---|---:|
| center | -208.16,1065.57 | 843.45,464.10 | .038 |
| left | -243.99,1093.88 | 847.09,465.17 | .278 |
| right | -171.27,1045.95 | 831.00,464.85 | .358 |
| top | -187.82,1056.28 | 835.11,469.98 | .283 |
| bottom | -189.16,1060.59 | 833.50,463.66 | .403 |
| top-left | -204.14,1068.81 | 838.21,472.13 | .336 |
| top-right | -137.49,1025.82 | 824.23,471.52 | .451 |
| bottom-right | -138.17,1030.02 | 823.20,465.17 | .615 |
| bottom-left | -192.56,1066.10 | 835.10,466.99 | .457 |
| return center | -142.16,1029.53 | 829.32,470.77 | .373 |

Earth's center is outside the viewport by design: only the lower-left sphere
fragment is visible. The center drift over this sequential audit demonstrates
why these rows cannot be subtracted as a pure pointer transfer function.

## Finding

The premise that normal edge input easily reaches 6..14 degrees is **not true
for this current checkpoint**. Maximum here was .615 degrees and fallback count
zero. The previous 6..14 degree observations came from explicit debug angular
sweeps. Before bounded drift, long-duration physical rotation could also carry
the single captured hemisphere away; that was already limited in 9790a8e.

The real opportunity is an explicit, fast-settling Earth-local perceptual response:
the inherited 1.15/s parallax stage has a long settling tail, and full-screen
input and global idle motion have been confused with the prior 7px *small-input*
measurement. Do not clamp the global camera or use a fixed 7px screen anchor.

## Scoped model to evaluate

Read existing pointer state without new listeners. Synthesize a read-only
neutral camera by removing only the documented pointer terms from the current
HOME pose; retain all idle camera motion. Apply the difference as Earth-local
3D translation plus a small bounded orientation and shared cloud phase response.
Original EarthRoot composition and every other object's input chain stay intact.
Keep anomalous/future camera poses outside this correction and retain fallback.

Compare smooth polynomial saturation, tanh, and C1 piecewise exponential;
compare fixed lerp, exponential damping and analytic critically damped response.
The final selection must be based on real browser motion and stress evidence.
