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

## Automatic Blender to Three handoff

```powershell
python tools/hero-cinematic-blender/convert_handoff_to_three.py
python tools/hero-cinematic-blender/validate_handoff_alignment.py
python tools/hero-cinematic-blender/test_handoff_conversion.py
```

The converter applies the fixed Blender Z-up to Three.js Y-up basis to positions,
targets, anchors, and camera rotation. It generates both the reviewable JSON
contract and the runtime JS module; do not copy handoff values into JavaScript by
hand.

## Home preview safety

Company-side planning only:

```powershell
powershell -ExecutionPolicy Bypass -File tools/hero-cinematic-blender/run_home_preview.ps1 -dryRun
powershell -ExecutionPolicy Bypass -File tools/hero-cinematic-blender/check_home_render_environment.ps1
```

On the approved RTX 5060 Ti home workstation, run the environment check first,
then omit `-dryRun` to render only frames 1, 78, 145, 198, and 240. The full
sequence script refuses to start unless `-confirmFullRender` is supplied and the
expected home GPU is detected.
