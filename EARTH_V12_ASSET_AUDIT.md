# Earth V1.2 asset forensic audit

Base: dccc33e (V1.1 candidate), contains latest verified origin integration 42b33bf.
Independent branch/worktree; the frozen HOME presentation and historic maps stay intact.

## Before: actual runtime inventory

| Role / file | Size / encoding | Runtime interpretation | Findings |
|---|---|---|---|
| earth-night-surface.webp | 2048x1024 RGB, 807190 bytes | sRGB, decoded to linear | Pre-graded dark atlas; low regional tonal range. Color-based land inference confounds ice/desert/water. |
| earth-city-lights.webp | 2048x1024 RGBA, 246964 bytes | NoColorSpace intensity | Geographic city coverage present, but small bright centers approach source-pixel size in closeup. |
| earth-clouds.webp | 2048x1024 RGBA, 650174 bytes | sRGB RGB + linear alpha | Broad weather coverage, coarse alpha edges and limited thin-cloud density; normal/shadow data absent. |
| land/ocean map | none | inferred from surface RGB | Not independently controllable, ambiguous coasts. |
| terrain / normal / height | none | surface texture derivatives | Not real geographic relief. |
| atmosphere LUT / noise assets | none | shader-only approximation | V1.1 limb depends on ground impact parameter rather than camera-to-atmosphere ray chord. |

All three maps use generated mipmaps, LinearMipmapLinearFilter, LinearFilter,
repeat longitude / clamp latitude, anisotropy 6. They are committed project assets;
their external provenance is not documented beside these files. This task does
not relabel them as public domain. No original bytes are altered.

Closeup projects a large fraction of a hemisphere into ~650px diameter. 2K global
maps only provide ~500-1000 useful longitude texels there, before foreshortening
and filtering. Cloud/city/coast detail is therefore visibly asset-limited, not
solved by enlarging point size, exposure or random shader noise.

## V1.2 sources / derivatives

Five genuine 8K Solar System Scope source maps (CC BY 4.0) yield four 4K lossless
WebP runtime maps. Original filenames, source URLs, license and change record:
`public/textures/hero/earth/orbital-v12/ATTRIBUTION.md`.
Exact sizes, byte counts, hashes and channel derivation: accompanying manifest.

| Runtime map | Channels / working space | Use |
|---|---|---|
| surface | RGB sRGB albedo; one GPU sRGB decode | Regional diffuse land response; NOT pre-baked night color |
| normal-land | RGB tangent normal, A land coverage; linear data | Geographic relief, water/land material separation, city exclusion |
| city | R settlement signal, G urban density, B hero metropolitan tier; linear data | Night emissive hierarchy from source geography, with broad dark rural/ocean zones |
| cloud | R density, G mesoscale density, B weather field; linear data | Continuous optical thickness, thin edges, coverage and approximate ground/cloud occlusion |

4K is a true downsample of 8K, not 2K enlargement. It supplies four times the old
texel count per map without making HOME download a full 8K atlas pack. No 16K,
external ML, Blender render, new meshes or additional postprocessing required.
RGBA8 + full mip estimate: ~170.7 MiB for four new maps, versus ~32 MiB for the
old three. WebP is download compression, not GPU texture compression.

Sampling: full mip chains, linear trilinear, anisotropy 8, longitude repeat.
Cloud low-pass wraps longitude. Data textures explicitly bypass sRGB decoding;
albedo alone is sRGB. Straight alpha is used for land coverage data only, not
premultiplied color. Materials output linear radiance into existing OutputPass
ACES/sRGB. No second gamma, no exposure/Bloom changes.

## Material-level changes

- Rough geographic land versus separate grazing water specular; restrained normal
  detail, source regional colors and weak twilight bounce. No geometry displacement.
- City classes follow warm night emission and locally averaged urban density. Water
  is excluded both in generation and runtime; cloud occlusion tracks shell rotation.
- Cloud weather is source-backed and stable, with optical thickness/self-occlusion,
  ground shadow hint and no frame-random noise. Thin physical shell: 1.8546 vs
  surface 1.85; city shell 1.8506 stays below the clouds.
- Eight-sample bounded atmosphere integration follows actual local camera/ray/sun
  geometry, clips against ground and includes Rayleigh/Mie-like terms. This is a
  real-time single-scattering approximation, not path-traced ground truth.
- Four draws preserved. 128x80 tessellation is candidate-only to avoid closeup limb
  faceting; old geometry and all non-Earth scene objects remain unchanged.

## A/B controls

`earthOrbital=1` is independent opt-in; omitted flag retains frozen shader/assets.
`earthAudit=1&earthFreeze=1` freezes both versions at their identical initial
surface/cloud phase for screenshot comparison. DEV-only layer isolation uses the
existing closeup mechanism. Gate asserts identical camera position/quaternion,
FOV, aspect, Earth position/scale/rotation and 1600x900 DPR1. Renderer/postprocess
files are unchanged. Screenshot derivatives receive no tone/contrast/sharpness edits.

## Final validation / visual decision

A/B/C were captured in HOME, closeup and four layer modes. B was retained after
one visual correction: restrained land direct energy/saturation and cloud direct
response, with slightly more weak night bounce. The source-backed weather and
regional terrain are clearer than the frozen maps at HOME size; atmosphere is
thinner and less neon. Closeup midnight is intentionally near-black, not night vision.
This is READY FOR HUMAN REVIEW, not a declaration of photorealism or HUMAN PASS.

Technical preservation fix: WebP `exact=True` retains tangent-normal RGB when the
packed land alpha is zero (ocean); alpha is data, not disposable transparency.
No runtime color correction compensates for a damaged data map.

All 36 current Node files / 44 runner cases, 12 Python visual tests, build and
diff check pass. Existing entry/return, both panels and five stage/four transition
renderer binding browser proofs pass. Console/runtime 0; Canvas/RAF/Wheel 1/1/1.
Real Edge RTX 5060 Ti: HOME 120.0 FPS, P95 8.4ms, GPU whole-frame 2.66ms, 53 draws;
closeup 120.0 FPS, P95 8.5ms, GPU whole-frame 1.29ms, 18 draws; Earth four draws.
Board VRAM HOME 1990/16311MiB includes all applications, not process allocation.
Live parallax moves Earth more than the distant Galaxy without a new controller.
Actual runtime video is recorded separately, never used to claim benchmark FPS.
No Blender/offline ground-truth render; source quality made one unnecessary.
