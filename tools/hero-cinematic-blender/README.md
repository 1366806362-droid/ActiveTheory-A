# Hero Cinematic Blender Prep V1.1

This directory builds a deterministic, low-GPU Blender skeleton for the scroll-driven Hero cinematic. It does not modify frontend runtime code and does not run Cycles or OptiX.

## Company build

```powershell
& 'C:\Tools\Blender-5.2-LTS\blender.exe' --background --factory-startup --python tools/hero-cinematic-blender/build_hero_cinematic_v2_scene.py -- `
  --config tools/hero-cinematic-blender/hero_cinematic_v2_config.json `
  --output art/hero-cinematic/blender-shot-v1/hero-cinematic-v2-prep.blend `
  --art-dir art/hero-cinematic/blender-shot-v1 `
  --render-preview
```

## Metadata and validation

```powershell
& 'C:\Tools\Blender-5.2-LTS\blender.exe' --background art/hero-cinematic/blender-shot-v1/hero-cinematic-v2-prep.blend --python tools/hero-cinematic-blender/export_hero_handoff_metadata.py -- --output art/hero-cinematic/blender-shot-v1/hero-handoff-metadata.json
& 'C:\Tools\Blender-5.2-LTS\blender.exe' --background art/hero-cinematic/blender-shot-v1/hero-cinematic-v2-prep.blend --python tools/hero-cinematic-blender/validate_hero_cinematic_v2_scene.py -- --output art/hero-cinematic/blender-shot-v1/scene-validation.json --metadata art/hero-cinematic/blender-shot-v1/hero-handoff-metadata.json
```

The preview build writes six `frame-v11-*.png` camera/composition checks and `camera-path-overview.png`. Validation records per-stage camera travel, galaxy screen coverage, and near-pass visibility. The home preset is configuration only. Do not execute it on the company workstation.
