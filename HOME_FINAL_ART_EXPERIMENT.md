# Home final art direction experiment

Status: **NOT READY FOR PRODUCTION**. Three candidates, two art corrections;
no release candidate selected. C is retained only as the final experimental state.
Previous pushed rollback: `2e91bc84a87e85739cb9bec33d3a0d91bab61382`.

## Scope and evidence

Opt in with `galaxyV3=1&galaxyHero=repaired_m3&homeArt=final` plus the existing
Earth V3 and support-star flags. Omitting `homeArt=final` preserves repaired M3.
Original source, Master, V4/V5/V5.1/V6/final-m3/repaired-m3 assets are untouched.
No changes to Camera, route/state, Scroll, Handoff, typography, Earth, internal
GEO/FiveA/Brand Mind, V2 bindings or data panels.

Candidate A restored the existing V3 BusinessNebulaLayer compositing order
through nested Groups, and differentiated existing particle layers without
adding points or draw calls. 5A became visible but overlapped the upper arm;
Brand Mind remained buried in the lower arm.

Candidate B moved 5A slightly left/up in its existing rear region and softened
the memory field. The four-cluster journey separated from the galaxy; memory
still lacked a readable silhouette.

Candidate C moved the deep memory field just below the lower arm, making it
discoverable but revealing separated defocused sprites instead of a cohesive
memory cloud. **This is the visual blocker. Do not label this a visual PASS.**
The hero-only smooth pointer bound also keeps large cursor motions from
introducing excessive LDI displacement. It does not alter Camera or global input.

Galaxy's bounded middle/right edit changes 1.7613% of source pixels, adds 0.1671%
total source luminance, preserves the exact Core and keeps dark dust minima.
It is deliberately minor; no topology, depth, LDI split or bloom redevelopment.
Five-layer transfer remains the existing compensated, coverage-conserving path.
Recomposite/source: occupied area 99.9915%, luminance 99.9978%, primary-arm
coverage 100%, halo 100%, new zero-alpha holes 0.

## Reproduction

Requires the same existing local Master/M3/V5.1 inputs as `M3_REPAIRED_CANDIDATE.md`.
No download or new model dependency. NumPy/Pillow only for source processing.

```text
py -3 tools/galaxy-v3-blender/build_home_final_art.py
node tools/home-final-art-gate.cjs
node tools/home-final-art-regression.cjs
py -3 tools/galaxy-v3-blender/report_home_final_art.py
node tools/m3-regression.cjs
py -3 -m unittest discover -s tools/galaxy-v3-blender -p "test_*m3*.py"
py -3 -m unittest discover -s tools/galaxy-v3-blender -p "test_home_final_art.py"
npm run build
git diff --check
```

Browser scripts use the existing Edge/Playwright setup with user approval.
Set `HOME_ART_OUTPUT=art/home-final-art/candidate-c` for the final capture.
Runtime gate is 1600x900 DPR1; report creates the lossless 640x360 small read.
Art/debug outputs stay untracked. The comparison uses current-run screenshots,
without exposure/color/sharpening changes. No full accessibility compliance claim.

## Verified regression

- 32 Node suites: 600 tests pass (575 JSON + 25 inventory assertions).
- 9 related Python tests pass; build and diff check pass.
- Actual mouse click into GEO/FiveA/Brand Mind and reverse-wheel return to
  HERO_START with routeIndex=0, same page, in sequence: pass.
- FiveA and Brand Mind panels open and close with Escape: pass.
- FiveA A1-A5 scale/energy match real renderer binding values; all four transition
  flowStrength bindings and nonzero rendered alpha arrays: pass.
- Console/runtime errors 0; Canvas1 / RAF1 / global Wheel1; app pointer listeners
  unchanged. Playwright's own two hit-target interceptors are excluded only after
  their recorded stack explicitly identifies them as test instrumentation.
- Warm steady-state runtime 119.86 FPS; isolated 120.04 FPS; Galaxy5 draw calls.
  Initial-load average FPS is not substituted for steady-state measurement.
- Existing baseline shader precision warning remains; no new runtime errors.

## Next boundary

Do not continue automatically. The highest unresolved visual benefit is making
Brand Mind's low-frequency memory field continuous while keeping its few fine
association points distinct. Do not solve this by another global brightness pass.
