# Hero Cinematic V2 asset slot

This directory is the future delivery slot for the approved Blender cinematic.
Large video files are intentionally not committed during engineering preparation.

Expected filenames:

- `hero-cinematic-v2-master.webm`
- `hero-cinematic-v2-gop6.webm`
- `hero-cinematic-v2-gop12.webm`

The runtime defaults to `cinematicAssetMode: placeholder`. The `final` mode has
an explicit placeholder fallback so a missing or undecodable final asset cannot
blank the Hero experience.
