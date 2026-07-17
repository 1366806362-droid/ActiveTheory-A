# Blender Hybrid Galaxy H1

H1 is an isolated Blender proof of concept. It is not loaded by the normal
ActiveTheory page and is not integrated into Three.js.

## Contents

- `render_h1_hybrid.py`: builds and renders the curved E2 disk, 44,000 3D
  particles, four local volumetric nebulae, edge dissolve, and the 8-second loop.
- `volume_common.py`: shared source-texture sampling and Blender helpers.
- `animation_common.py`: deterministic animation/material helpers retained from
  the R2.1 experiment.
- `compose_h1.py`: creates Hero review frames and alpha checkerboard reviews.
- `encode_h1_videos.py`: encodes VP9 Alpha WebM and the Hero MP4.
- `h1-settings.json`: reproducible H1 parameters.
- `assets/hero-base-v1-no-galaxy.jpg`: review-only Hero composition base.
- `scenes/h1-hybrid.blend`: generated Blender scene retained as a convenience;
  the Python scripts remain the source of truth.

## Render

Run from the repository root. The output-frame directories are intentionally
outside Git and must not be committed.

```powershell
$blender = "C:\path\to\blender.exe"
& $blender --background --python tools/blender/h1/render_h1_hybrid.py -- `
  --source public/textures/hero/galaxy/main-galaxy-v2.webp `
  --output art/galaxy-v3/blender-hybrid-h1 `
  --frames C:\temp\h1\galaxy-frames `
  --mask C:\temp\h1\derived\h1-edge-mask.png
```

Then compose and encode review media:

```powershell
python tools/blender/h1/compose_h1.py `
  --galaxy-frames C:\temp\h1\galaxy-frames `
  --hero-frames C:\temp\h1\hero-frames `
  --output art/galaxy-v3/blender-hybrid-h1

python tools/blender/h1/encode_h1_videos.py `
  --ffmpeg C:\path\to\ffmpeg.exe `
  --galaxy-frames C:\temp\h1\galaxy-frames `
  --hero-frames C:\temp\h1\hero-frames `
  --output art/galaxy-v3/blender-hybrid-h1
```

The generated WebM must report VP9 with `ALPHA_MODE=1`; decoding a frame with
libvpx-vp9 must preserve alpha extrema `0..255` and transparent corners.
