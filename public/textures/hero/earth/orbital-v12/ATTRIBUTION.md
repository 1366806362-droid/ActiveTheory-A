# Earth Orbital V1.2 texture attribution

Original Earth maps by **Solar System Scope / INOVE**, based on NASA imagery
and elevation data. Licensed under **Creative Commons Attribution 4.0 International**.

- Author/source: https://www.solarsystemscope.com/textures/
- License: https://creativecommons.org/licenses/by/4.0/
- No endorsement by Solar System Scope or NASA is implied.

Original filenames (all 8192x4096; downloaded 2026-09-08):

| Source | Download location |
|---|---|
| `8k_earth_daymap.jpg` | https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg |
| `8k_earth_nightmap.jpg` | https://upload.wikimedia.org/wikipedia/commons/b/b3/Solarsystemscope_texture_8k_earth_nightmap.jpg |
| `8k_earth_clouds.jpg` | https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg |
| `8k_earth_normal_map.tif` | https://www.solarsystemscope.com/textures/download/8k_earth_normal_map.tif |
| `8k_earth_specular_map.tif` | https://www.solarsystemscope.com/textures/download/8k_earth_specular_map.tif |

The day/night files use the attributed Wikimedia Commons copies because their
original-site download requests returned HTTP 403. Description/license pages:
https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_daymap.jpg
and https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_nightmap.jpg.

Changes by ActiveTheory: Lanczos resampling to 4096x2048; lossless WebP encoding;
packing land coverage into normal alpha; extracting warm night emission and
urban-density tiers, with water exclusion; packing continuous cloud density,
mesoscale density and weather coverage. No new synthetic cities, sharpening,
upscaling, AI reconstruction or generative images. The shader interpretation is
art-directed and approximate, not a scientific radiance/terrain product.

All derived textures retain CC BY 4.0 attribution. Keep this file with distributed
assets. `manifest.json` records source and output SHA256 hashes. Original source
files remain local in `art/earth-v12/sources/` and are not required by runtime.
Reproduce derivatives with `python tools/earth-orbital-assets.py`.
