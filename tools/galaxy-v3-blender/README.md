# Galaxy Hero Asset V1

Isolated Blender lookdev pipeline for the Galaxy V3 hero asset. It does not edit or load the legacy Hero Cinematic V1.4 scene and does not touch Three.js.

## Outputs

- `art/galaxy-v3/hero-v1/galaxy-hero-v1.blend`
- `art/galaxy-v3/hero-v1/GALAXY_HERO_V1_RGBA.png`
- `art/galaxy-v3/hero-v1/GALAXY_HERO_V1_PREVIEW.png`
- build, render, and GPU telemetry JSON reports

## Dry run

```powershell
powershell -ExecutionPolicy Bypass -File tools/galaxy-v3-blender/run_galaxy_hero_v1.ps1 -DryRun
```

## Render

```powershell
powershell -ExecutionPolicy Bypass -File tools/galaxy-v3-blender/run_galaxy_hero_v1.ps1
```

The renderer requires the local RTX 5060 Ti and enables only the OptiX device. CPU fallback is intentionally disabled.
