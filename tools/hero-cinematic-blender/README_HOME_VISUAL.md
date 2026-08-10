# Hero Cinematic V2 — Home Visual Asset Skeleton V1

This tool augments the locked Blender Prep V1.1 scene with deterministic,
LookDev-ready asset structure. It never redesigns the Camera Path, LookAt Path,
timeline, handoff, Galaxy anchor, or GEO/5A/Brand Mind anchors.

## Company skeleton

```powershell
& 'C:\Tools\Blender-5.2-LTS\blender.exe' --background `
  'art/hero-cinematic/blender-shot-v1/hero-cinematic-v2-prep.blend' `
  --python 'tools/hero-cinematic-blender/build_home_visual_skeleton.py' -- `
  --config 'tools/hero-cinematic-blender/hero_visual_config.json' `
  --baseline 'docs/hero-cinematic/blender-shot-v1/hero-handoff-baseline-v11.json' `
  --camera-config 'tools/hero-cinematic-blender/hero_cinematic_v2_config.json' `
  --output 'art/hero-cinematic/home-visual-skeleton-v1/hero-cinematic-company-skeleton-v1.blend' `
  --art-dir 'art/hero-cinematic/home-visual-skeleton-v1' `
  --preset companySkeleton `
  --render-debug
```

The company preset creates only low-density mesh proxies and three Workbench
structure checks. It does not start Cycles or OptiX.

## Validation

```powershell
& 'C:\Tools\Blender-5.2-LTS\blender.exe' --background `
  'art/hero-cinematic/home-visual-skeleton-v1/hero-cinematic-company-skeleton-v1.blend' `
  --python 'tools/hero-cinematic-blender/validate_home_visual_skeleton.py' -- `
  --config 'tools/hero-cinematic-blender/hero_visual_config.json' `
  --baseline 'docs/hero-cinematic/blender-shot-v1/hero-handoff-baseline-v11.json' `
  --camera-config 'tools/hero-cinematic-blender/hero_cinematic_v2_config.json' `
  --three-contract 'docs/hero-cinematic/blender-shot-v1/hero-handoff-three-v11.json' `
  --output 'art/hero-cinematic/home-visual-skeleton-v1/visual-skeleton-validation.json'
```

## Home LookDev preparation

Dry-run anywhere:

```powershell
powershell -ExecutionPolicy Bypass -File tools/hero-cinematic-blender/prepare_home_lookdev.ps1 -dryRun
```

Run without `-dryRun` only on the approved RTX 5060 Ti workstation. The command
regenerates the locked camera scene if necessary, builds the high-density asset
skeleton, and saves `hero-cinematic-home-lookdev-v1.blend`. It prepares the
scene only: no render operator is invoked.
