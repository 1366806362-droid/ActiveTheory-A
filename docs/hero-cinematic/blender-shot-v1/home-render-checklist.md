# RTX 5060 Ti home render checklist

## Locked composition contract

Do not redesign these unless a formal preview proves a severe handoff defect:

- Camera Path and LookAt Path.
- Eight-second, 30 FPS, frame 1–240 timeline and scroll-progress mapping.
- Final handoff camera, target, vertical FOV, and frames 227–240 stability zone.
- GEO, 5A, and Brand Mind entry anchors.
- The values recorded in `hero-handoff-baseline-v11.json`.

## Home visual-development scope

The RTX 5060 Ti pass may develop:

- final galaxy asset and non-regular spiral arms;
- star density and galactic dust;
- nebula volume and foreground dust;
- near-pass visuals and cosmic-flow particles;
- lighting, exposure, motion blur, Cycles/OptiX, and denoise.

The blue galaxy proxy is only a spatial, scale, and camera reference. Do not polish its ellipse into the final galaxy. The final galaxy must have real depth, spiral structure, dust and nebula layers, remain partly outside the frame, and never return to a centered complete disk.

Cosmic Flow curves are direction guides only. Do not render them as visible glowing lines; replace them with many restrained dust or matter particles that collectively form curved flow.

## First home preview

1. Open a copy of the generated `.blend`; retain all collection and anchor names.
2. Switch to the stored home preset only on the RTX 5060 Ti workstation.
3. Enable Cycles GPU and OptiX deliberately and verify the selected GPU.
4. Keep every stochastic system deterministic by seed or bake.
5. Render low-sample stills only at frames 1, 78, 145, 198, and 240.
6. Validate immense scale, travel speed, galaxy discovery, and final handoff composition.
7. Confirm frames 227–240 remain clear of high-speed near passes.
8. Compare frame 240 against `hero-handoff-baseline-v11.json` before changing any locked transform.
9. Only after the five key frames pass may a full 240-frame sequence be considered.
10. Use short-GOP 1920×1080 tests before final output, re-export metadata after any approved contract change, and rerun scene validation.
