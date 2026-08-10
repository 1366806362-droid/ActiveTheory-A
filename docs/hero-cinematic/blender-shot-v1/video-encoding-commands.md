# Hero Cinematic V2 video encoding templates

These commands are templates for a separately approved workstation with FFmpeg.
Do not execute them when `ffmpeg -version` is unavailable. The PNG source is the
approved 1920x1080, 30 FPS frame sequence.

## GOP 6 scrub test

```powershell
ffmpeg -framerate 30 -i "art/hero-cinematic/home-full-sequence-v1/frame-%03d.png" -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 0 -crf 20 -g 6 -row-mt 1 -an "public/cinematic/hero-v2/hero-cinematic-v2-gop6.webm"
```

## GOP 12 scrub test

```powershell
ffmpeg -framerate 30 -i "art/hero-cinematic/home-full-sequence-v1/frame-%03d.png" -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 0 -crf 20 -g 12 -row-mt 1 -an "public/cinematic/hero-v2/hero-cinematic-v2-gop12.webm"
```

Compare scroll-seek latency, dropped frames, file size, and visual stability.
Choose the shortest GOP that meets quality and delivery-size constraints, then
encode the approved master as `hero-cinematic-v2-master.webm`. Never promote a
test encode without browser scrub and Blender-to-Three handoff review.
