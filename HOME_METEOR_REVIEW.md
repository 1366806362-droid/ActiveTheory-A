# HOME subtle meteor accent

## Shared baseline promotion — 2026-09-15

Human accepted source `310cffe310eedcaca31d1664aba16900f4f80342`.
Normal HOME enables the accent without a query parameter. Use explicit
`homeMeteors=0` (or `false`) to disable it. Reduced-motion and non-HOME scenes
continue to suppress playback without queued catch-up.

Independent from FiveA color/depth and from all frozen HOME art.
No HOME Galaxy, Hybrid Earth/Hero Lock, entry layout, typography, global exposure
or Bloom edits. No FiveA internal meteors.

## Design and lifecycle

One reusable plane/material: cool low-saturation short head and tapered tail.
One at a time, visible 1.15s, random deterministic wait 17-29s after the previous
event ends. Most HOME time has no extra draw. Safe paths are selected before
animation, rejecting the whole tail/path envelope against title, scroll, Earth,
Galaxy Core and current projected business entry bounds. No mid-path hard hiding
to evade content, no pointer-following or business meaning.

Uses existing Universe update/disposal. Hidden/inactive/reduced-motion state
stops nonessential decoration; return schedules a fresh wait without catch-up.
No timers, event listeners, secondary RAF, new render targets, textures or global
postprocessing. Development-only `__HOME_METEOR_REVIEW__.triggerOnce()` gives
repeatable evidence; normal cadence never calls it.

No HOME art correction was needed after the initial implementation. Paths remain
in sparse peripheral space; faintness is intentional, not a new focal point.

## Evidence

`art/fivea-color-depth/HOME_METEOR_FRAME_SEQUENCE.png` is explicitly marked
**DEV SINGLE TRIGGER**. `HOME_METEOR_DEMO.mp4` records 75 seconds of ordinary
runtime cadence at original timestamps without forced events or speed changes.
Images are native PNG; video encodes native PNG frames without grading.

Same-condition HOME OFF vs source `3b131b8`: only 7 pixels differ, maximum one
8-bit channel level. This is not claimed bit-identical, nor assigned an unproven
cause. HOME ON idle vs OFF is exactly equal. No change to other object positions
or art parameters accompanies the switch.

## Performance and checks

Headed Edge, RTX 5060 Ti, 1600x900 DPR1, visible 120Hz conditions. No capture
during performance samples; 10s warmup then separate 60s OFF and ON observations.

| HOME | Median / P95 / P99 ms | Max ms | >50 / >100ms | Draw calls |
| --- | --- | --- | --- | --- |
| OFF | 8.3 / 8.4 / 8.5 | 8.7 | 0 / 0 | 51 |
| ON | 8.3 / 8.4 / 8.5 | 8.6 | 0 / 0 | 51 idle / 52 during event |

ON measured average 51.039 draws. A pooled two-triangle plane adds no particles.
Separate GPU query: OFF median/P95 3.101/4.031ms (60 samples), ON 2.900/4.125ms
(59 samples), zero disjoint events. Entire frame, not isolated meteor cost;
RAF timing is not GPU timing. These samples do not establish a GPU speedup.
Normal-cadence video is 76.0s including encoding's final frame duration; native
source span 75.889s. Three ordinary events occurred, without forced triggering.
Total VRAM is not reliably exposed by the browser and is not claimed.

Three new tests cover sparse cadence, pause/resume/reduced-motion without
backlog and conservative path rejection. Full milestone suite: 45 Node files,
108 runner tests / 688 named actual cases, no failures/skips; Python 6 passed;
build and diff check passed. Browser regression validates HOME entries/returns,
GEO, Brand Mind, both Panels, FiveA scale/energy and four flowStrength bindings.

Reproduce with `node tools/color-depth-runtime.cjs home`, `safety`, `perf` or
`home-video`; use `python tools/color-depth-evidence.py` for the evidence gallery.
Art, screenshots, video and cache stay untracked. No shared-Master integration.
