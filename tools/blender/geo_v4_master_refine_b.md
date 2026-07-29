# GEO V4.1.9-B Candidate B Refinement Execution Pack

This pack prepares Candidate B — Darker Cinematic for staged refinement on the
home RTX 5060 Ti 16GB workstation. The company workstation may run
`--prepare-only` and read-only diagnostics only.

It does not replace the original V4.1.9 master, change the website, export a
new GLB, connect Journey, or execute any task automatically.

## Locked source and working copy

- Locked source:
  `art/geo-scene/v419-blender-master-lookdev/geo-v4-master-lookdev.blend`
- Locked source SHA-256:
  `23F876E145D6BECF7A4F96A216C4CF2CC26F6A62290580BEF4A56C764ABB7361`
- Candidate B working copy:
  `art/geo-scene/v419-blender-master-lookdev/geo-v4-master-lookdev-b-working.blend`
- Scene audit:
  `tools/blender/geo_v4_candidate_b_scene_audit.json`

`--prepare-only` refuses to replace an existing working copy unless
`--force-working-copy` is explicitly supplied. Preserve the existing working
copy before ever using that override.

## Company workstation procedure

Only this action is authorized at the company:

```powershell
& "C:\Tools\Blender-5.2-LTS\blender.exe" `
  --background `
  --factory-startup `
  --python "tools/blender/geo_v4_master_refine_b.py" `
  -- `
  --prepare-only
```

This action:

1. verifies the locked source SHA-256;
2. opens the original master read-only;
3. records the full scene audit;
4. applies the existing Candidate B baseline to a separate working scene;
5. saves the working master;
6. verifies that the original master hash is unchanged;
7. renders nothing.

Do not run B1, B2, B3, Review, Final, animation, baking, high-sample Cycles or
heavy Geometry Nodes on the company workstation.

## Home workstation setup

1. Pull and switch to `poc/geo-v4-blender-b-refine`.
2. Install Blender 5.2 LTS.
3. Open
   `tools/blender/geo_v4_master_refine_b_commands.ps1`.
4. Replace `<BLENDER_EXE_PATH>` with the absolute Blender executable path.
5. Dot-source the command file:

```powershell
. .\tools\blender\geo_v4_master_refine_b_commands.ps1
```

6. Run `Test-CandidateBGpu`.
7. Confirm an NVIDIA OptiX device is reported before invoking any render.

Every rendering preset requires OptiX. The Python script raises an error when
OptiX is unavailable and never falls back to CPU.

## Independent refinement phases

The phase names describe visual scope, not incremental file dependencies.
Every phase command verifies and opens the locked source master, applies the
Candidate B baseline once, resolves the configured phase plan, and replaces
the working blend with that deterministic result:

- B1 resolves to Baseline → B1.
- B2 resolves to Baseline → B1 → B2.
- B3 resolves to Baseline → B1 → B2 → B3.
- Review and Final use the complete B3 sequence.

No phase reads visual state from a previously modified working blend. The
working blend is only the latest deterministic output for inspection or
rendering. The original master is never saved or overwritten.

### B1 — Material & Lighting

- replace the blocky teal lookdev response with thin-film transmission;
- create thickness variation through membrane body visibility and transmission;
- restore deep navy negative space;
- introduce local ice-blue and restrained cold-purple transmission;
- reduce and stratify white signal-node scale and emission;
- preserve the current main geometry.

Home command:

```powershell
Invoke-CandidateBB1Preview
```

This command reconstructs Baseline + B1 from the locked source.

### B2 — Cavity & Tissue Structure

- deepen the central Z-axis cavity without a circular mask;
- pull convergence tissue backward;
- shrink nearby cell nodes toward the center;
- converge local cellular fibers;
- add restrained non-destructive wrinkle displacement;
- strengthen only local foreground enclosure.

Home command:

```powershell
Invoke-CandidateBB2Preview
```

This command reconstructs Baseline + B1 + B2 from the locked source. Running
B1 first is optional; B2 does not depend on the previous working blend.

### B3 — Business Integration

- make ANSWER the left high-density neural region;
- preserve CITATION as a sparse upper-right source network;
- embed KEYWORD as two tissue veins without parallel rails;
- place business objects at slightly different membrane depths;
- keep the center as the first visual focus;
- create no new ring, Y-shaped highway or complete route.

Home command:

```powershell
Invoke-CandidateBB3Preview
```

This command reconstructs Baseline + B1 + B2 + B3 from the locked source.
Running B1 or B2 first is optional. Each phase has its own command and can be
recognized and executed separately; identical source, config, phase and preset
produce the same phase state without cumulative drift.

## Render presets

| Preset | Effective output | Cycles samples | Device | Denoiser | Transparent bounces | Volume bounces | PNG |
| --- | ---: | ---: | --- | --- | ---: | ---: | --- |
| Preview | 960×540 at 50% | 64 | OptiX | OptiX | 6 | 1 | 8-bit |
| Review | 1920×1080 | 256 | OptiX | OptiX | 12 | 2 | 16-bit |
| Final | 1920×1080 | 512 | OptiX | OptiX | 16 | 4 | 16-bit |

All presets use AgX Medium High Contrast. Review uses moderate volume settings.
Final uses the formal volume step rate and higher transparent/volume bounce
limits.

Review and Final are intentionally separate:

```powershell
Invoke-CandidateBReview
Invoke-CandidateBFinal
```

Both commands resolve the complete Baseline + B1 + B2 + B3 chain before using
their requested render preset. Neither command is called by another function.
There is no “run everything” command.

## Diagnostics and hashes

GPU and scene diagnostics:

```powershell
Test-CandidateBGpu
```

Source, working master, script and config SHA-256:

```powershell
Get-CandidateBFileHashes
```

`--diagnostics` verifies and opens the locked source master, reports the B1,
B2, B3, Review and Final resolved phase sequences, and prints scene/GPU state.
It does not save or render.

## Outputs created on the home workstation

Phase renders are written only when a phase command is run:

`art/geo-scene/v419-blender-master-lookdev/b-refine-renders/`

Expected filenames:

- `candidate-b-b1-preview.png`
- `candidate-b-b2-preview.png`
- `candidate-b-b3-preview.png`
- `candidate-b-b3-review.png`
- `candidate-b-b3-final.png`

The company-side preparation step must not create this directory or any render
image.

## Stop conditions

Stop without rendering when:

- the original master SHA-256 differs from the locked value;
- the working master marker is missing;
- NVIDIA OptiX is unavailable;
- Blender attempts to use CPU;
- a phase would overwrite the original master;
- B3 begins to recreate a Y-shaped route, KEYWORD rails or a closed core ring;
- Review or Final is accidentally selected on the company workstation.
