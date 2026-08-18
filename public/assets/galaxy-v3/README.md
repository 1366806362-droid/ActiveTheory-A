# Galaxy V3 asset slot

This directory reserves project-relative slots for the future Blender-authored
Galaxy V3 hero asset. Foundation V1 ships no production render.

- `hero/`: transparent image, sequence, alpha video, GLB, or mesh payloads
- `depth/`: optional depth maps or sequences
- `mask/`: optional alpha and isolation masks
- `preview/`: lightweight review proxies

Runtime selection is declared in `manifest.json`. Large renders and temporary
look-development outputs must not be committed here.
