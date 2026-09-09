# ActiveTheory Project State

## Confirmed / frozen

- **Home visual baseline:** `origin/feat/home-target-frame-v1` at
  `e3d9a8279caeb8fb857fdd21746f8533808435a3`; this owns the approved Home
  composition, Earth, Galaxy, camera, and visual assets.
- **V2 renderer-adapter dry-run:**
  `origin/feat/active-theory-v2-renderer-adapter-dry-run` at
  `69e01369335aca0c3f4aef79563686a6f22b3fec`; it is non-rendering and includes
  the Canonical, Derived, Binding, Replay, and FakeRendererState layers.
- **FiveA Data Panel V1.1:** `1cf69b314e80865775744082a6d227d27fbb385f`.
  Opportunity Pool remains separate from A1-A5.
- **Brand Mind Data Panel V1.1:** `0d8d3b7c5eae181cdd185c7336dd9c6da0f8e766`.
  Renderer/shader/GPU-particle art is frozen.
- **GEO:** the integrated line retains the existing GEO scene, entry, and data
  paths; do not create a parallel GEO schema.

## Master integration

- Branch: `integration/active-theory-master`.
- Integration merge baseline: `1ade223` (Home + V2-3A.2 + the V2 renderer
  target-inventory checkpoint). Read `git rev-parse HEAD` for the live handoff
  revision after documentation/checkpoint commits.
- The integration must preserve Home visual code as the visual source of truth
  and use the latest V2 code only under `src/v2/`.

## In progress

- **V2-3B preflight inventory:**
  `5f5bd3c` on `feat/active-theory-v2-renderer-target-inventory` inventories 46
  binding channels and 27 observed runtime targets. It is a read-only,
  non-rendering checkpoint.

## Blocked / not ready

- **Whole-project V2-3B renderer binding remains blocked** until the Brand Mind Association
  Stable Registry (`associationId -> runtime node`) and Brand Mind Relationship
  Stable Registry (`sourceId + targetId -> runtime path`) are established and
  revalidated on the integrated line. The explicitly user-authorized A3-only
  vertical slice below is independent of those Brand Mind targets; it does not
  declare all 46 channels ready.
- Galaxy experiments and Blender visual routes remain experimental unless their
  own human visual review explicitly marks them ready. No visual parameter is
  automatically adopted into the Home baseline.

## Local-only assets and protected work

- Keep untracked `art/`, screenshots, design QA files, caches, archives, Blender
  files, and render outputs local unless an explicit scoped approval says
  otherwise.
- Existing worktrees, including the original ActiveTheory-A WIP, are protected.
  Do not move, clean, reset, stash, or overwrite them while working elsewhere.

## Next

1. COMPANY: implement only the two Brand Mind stable target registries with no
   visual behavior change; rerun V2-3B preflight.
2. If and only if preflight is READY, hand off the actual renderer-adapter scope
   for separate approval. HOME remains responsible for high-load visual work.

## FiveA A3 vertical slice — scoped feature checkpoint

- Branch: `feat/active-theory-v2-3b-fivea-a3-vertical-slice`, created from actual
  remote Master `660d8a0c5d938b31eccd3d4da4c9aea559a37e2b` in an independent
  worktree. Master is not modified or merged by this task.
- The reported 464-test history includes separate Brand Mind registry work
  (`22fa32ed10e24f133d3a7cc219402a47fda49316`), which was not in this Master.
  This feature retains all 450 tests actually present in its base.
- Only A3 scale + existing opacity/energy are connected to the real renderer,
  through the same Canonical consumer as the FiveA panel. Density is deferred;
  static GPU geometry and all shader art remain unchanged.
- Development-only LOW / BASELINE / HIGH / PARTIAL queries are documented in
  `src/v2/README.md`. Normal and production entry points preserve the frozen art.
- No A1/A2/A4/A5, transitions, Brand Mind, or GEO binding is implemented. Any
  expansion requires a separate milestone; the current task stops after A3.
- Engineering validation: 486/486 tests (450 inherited + 36 new), build and
  diff check PASS; normal/direct/demo browser entry, panel open/close/ESC and
  wheel isolation PASS. One Canvas and one primary RAF chain; no browser
  error/warning observed. Screenshot/value evidence stays local under
  `art/v2-3b-fivea-a3/`. This is an opt-in technical checkpoint, not art approval.

## FiveA A1-A5 stage expansion — scoped feature checkpoint

- Independent branch `feat/active-theory-v2-3b-fivea-stages` starts at A3 remote
  `928acdc78ee72aed67211a7b358ad2aa9cbc7ae0`. Master and original worktrees
  remain untouched. This milestone supersedes only the prior A3 scope limit.
- One stable-ID adapter binds scale + energy for A1-A5, using the same Canonical
  provider as the Panel. The A3 API remains a compatibility wrapper.
- Atomic apply/rollback, idempotence, 200 repeated snapshot cycles, per-stage
  isolation, partial/missing metadata and restore/dispose are verified against
  actual Three.js matrices and uniforms. No geometry rebuild or GLSL edits.
- BALANCED / CONTRAST / PARTIAL are opt-in synthetic engineering fixtures.
  Existing transitions and Opportunity facts remain unchanged; these are not
  claimed to be realistic funnel datasets. Normal URLs preserve unbound art.
- 532/532 tests (486 inherited + 46 new), build and diff check PASS. Browser
  proof uses the same camera/time/viewport for all three states. Canvas=1 and
  primary RAF chain=1. Local evidence stays under `art/v2-3b-fivea-stages/`.
- Density remains TODO. Transition binding is the next separately approved
  milestone; no transition, GEO, Brand Mind, camera or composition binding is
  authorized by this feature. No high-load visual rendering was executed.

## FiveA A2_TO_A3 flow strength — scoped feature

- Branch `feat/active-theory-v2-3b-fivea-a2-a3-flow` starts at verified remote
  A1-A5 stage checkpoint `05248fea01c1fc350afba77084c69c1ddde0c7bd`, in an
  independent worktree. Original worktrees and integration Master are untouched.
- Actual supported channels: A1-A5 SCALE/ENERGY plus A2_TO_A3 FLOW_STRENGTH.
  One shared transfer batch has CPU-updated aAlpha. Stable endpoint IDs identify
  the A2_TO_A3 particle subset; only its reference alpha is multiplied. No new
  geometry, shader, particles, paths, anchors, batches or render loops.
- flowSpeed is deferred: the existing travel and stable drift use shared
  absolute time, not an independently accumulated segment phase. Applying a
  speed multiplier would jump phases. Formal Mapping still maps volume to speed;
  the adapter intentionally does not execute that channel.
- LOW/BASELINE/HIGH use an explicitly SYNTHETIC tracked cohort of 1000 entrants,
  with 100/500/900 observed exits and consistent rates. These are independent
  of stage snapshot populations. PARTIAL keeps observed exits/rate missing.
  All fixtures remain MOCK; no source verification or real history is invented.
- Same Canonical provider supplies Panel and both real adapters. Other stages,
  transitions and Opportunity facts/bindings are unchanged. Normal and existing
  demo URLs retain their prior opt-in behavior.
- Derived revision 2 removes the invalid fallback from missing transition cohort
  in/out to stage snapshot populations. Missing Panel counts now stay missing;
  no Panel UI or rate Mapping was changed.
- 556/556 tests PASS (532 inherited + 24 flow tests), build/diff PASS. Real alpha
  readbacks verify monotonicity, rollback, 100 HIGH/LOW cycles, idempotence and
  disposal. Local browser evidence includes 12 fixed-time JPEG frames, identical
  camera/viewport/seed, Panel checks, one Canvas and one primary RAF chain.
- No Transition expansion, high-load rendering, or visual art approval implied.

## FiveA four-transition flow-strength expansion — scoped feature

- Branch `feat/active-theory-v2-3b-fivea-transitions` starts from verified
  remote A2_TO_A3 checkpoint `7dd7f662f6f057b8a12d50565ea643bc557cf8b7` in an
  independent worktree. No integration or Master branch is changed.
- A single stable-ID adapter now applies only `FLOW_STRENGTH` to
  `A1_TO_A2`, `A2_TO_A3`, `A3_TO_A4`, and `A4_TO_A5`. Each target is the
  corresponding existing subset of the shared transfer batch; the adapter
  changes only that subset's existing alpha reference multiplier.
- Development fixtures select exactly one transition and use a labelled
  MOCK/SYNTHETIC tracked cohort of 1000 entrants: LOW=100 exits, BASELINE=500,
  HIGH=900, PARTIAL=null. They never derive a conversion rate from adjacent
  stage populations. The same snapshot is supplied to the panel and renderer.
- `flowSpeed` and density remain unbound. Shared absolute-time animation,
  geometry, paths, particles, batches, stage scale/energy, Opportunity, camera,
  composition, shader art and UI layout remain unchanged.
- The generic adapter validates the full four-transition plan before writing,
  is idempotent, rolls back atomically on errors, preserves missing metadata,
  restores on dispose and creates no per-frame business work. Local-only
  evidence is written beneath `art/v2-3b-fivea-transitions/`.
- Engineering validation: 584/584 Node tests, production build and diff check
  pass. Browser proof confirms four MOCK/SYNTHETIC snapshots, one Canvas, one
  primary RAF chain, panel close/ESC isolation and normal wheel ownership after
  close. No high-load visual rendering was executed.

## Master integration: FiveA stage and transition bindings

- The integration line includes the verified FiveA renderer-binding history from
  `946723cdda962b8e0ec43e3d9a2eedce909c8cdd`: A1-A5 scale/energy and the four
  adjacent transition `FLOW_STRENGTH` channels are real stable-target bindings.
- All development verification scenarios remain explicitly MOCK/SYNTHETIC.
  This is not a real business-data rollout and normal/default entries do not
  force a demonstration mode.
- `flowSpeed` and density remain unbound. GEO and Brand Mind real renderer
  binding are not completed by this integration.
- HOME retains ownership of approved camera, composition, Galaxy, Earth and
  high-load visual work. COMPANY remains limited to source, contracts, tests,
  configuration and low-load validation.

## HOME final V1 (human pass / visual freeze)

- Independent branch `feat/home-final-candidate-v1` starts at verified visual
  checkpoint `5ee248174c96b5cc8d550267948e2fb23604dfde`, which already contains
  integration `a6cffbbe3442dbec3bf37463bfdd7f8bba71da04`. No merge was needed.
- Opt in with `homeFinalV1=1` alongside `galaxyV3=1&galaxyHero=repaired_m3&homeArt=final`.
  Keep `earthV2=1&earthV3=1&brandMindMemory=1` for the complete reviewed home.
  `homeJourney=0` and `earthFinal=0` independently select the old presentations.
- Journey B: five irregular non-coplanar migration clusters, interrupted GPU
  flow and sparse dust; 18,000 static particles in one draw batch. It reuses the
  existing 5A entrance, label, hover and update/dispose ownership, not internal stages.
- Earth Balanced: existing surface/city/cloud textures and four existing sphere
  draws. A shared lighting frame and ground-limb impact parameter remove the
  detached atmosphere band. Night material, urban tiers and eroded cloud alpha
  are local-only; no exposure, camera, pose or scale changes.
- Three candidates per component were compared; each received one visual
  correction. Galaxy assets/LDI, Brand Mind memory field, GEO, typography,
  routes, scene internals, panels and V2 bindings are unchanged.
- Validation: 614 Node tests, nine existing Python visual tests, build and
  diff check pass. Actual RTX 5060 Ti / Edge runtime: steady 120 FPS, P95 8.5 ms,
  53 measured draws including postprocessing (previous 62), 156,237 visible
  point vertices. Earth four draws, Galaxy five; one Canvas/RAF/wheel listener.
- Real browser entry/return and both panels pass; all five stage scale/energy
  and four transition flowStrength bindings retain their explicit MOCK proof.
- Reproducible evidence: `tools/home-final-v1-gate.cjs`,
  `tools/home-final-v1-evidence.py`, `tools/home-final-v1-motion.cjs` and the
  existing `tools/home-final-art-regression.cjs`. Outputs stay local in `art/`.
- **HOME FINAL V1 = HUMAN PASS / VISUAL FREEZE.** Galaxy, Earth, 5A, GEO and
  Brand Mind homepage presentations are now the V1 frozen visual baseline.
  This preserves their approved hierarchy, negative space, camera and runtime
  ownership; subsequent work must be separately approved rather than changing
  the frozen HOME presentation.

## Earth Realism V1.1 — independent human-review candidate

- Base: `42b33bfc6e873e29cc6fb2b0e2a9fa992f101f66`, latest verified
  `origin/integration/active-theory-master` on 2026-09-08. Candidate branch:
  `feat/home-earth-realism-v11`; no integration into the frozen HOME baseline.
- Explicit `earthRealism=1` with `earthV2=1&earthV3=1` selects B. Removing the
  flag restores byte-identical frozen shader sources. A/B/C material interpretations
  were captured; B retained, with one correction for double-darkened night atlas
  and metropolitan readability. No second correction or additional visual scope.
- Existing 2048x1024 WebP surface/cloud sRGB atlases and linear-intensity city
  atlas reused unchanged (mipmapped linear filtering, anisotropy 6).
- Four existing spheres: region-preserving rough land versus dark ocean glint;
  atlas-driven settlement/metropolis tiers with cloud occlusion; multiscale cloud
  optical thickness and relative-rotation shadow; single-shell tangent optical-depth
  atmosphere with inner rim, outer haze and localized sunrise. These are lightweight
  shading approximations, not physical volumetric scattering or measured terrain.
- Same linear render path and final OutputPass; no global exposure, bloom,
  renderer, camera, transform, speed, Galaxy or business visual modifications.
- Dev-only `earthFreeze=1`, `earthDebugLayer=surface|cloud|city|atmosphere`, and
  existing `debugEarthV3Closeup=1` provide layer audits, not product UI.
- Validation: all 35 current Node test files pass (39 runner cases including
  five new realism tests and existing custom suites); nine Python visual tests,
  build and diff check pass. Real Edge / RTX 5060 Ti: HOME and closeup ~120 FPS,
  frame P95 8.4ms; Earth four draws, total HOME 53 / closeup 18. GPU elapsed
  whole-frame averages ~3.09ms HOME / ~1.51ms closeup; these include postprocessing,
  not isolated Earth shader timings. Board VRAM ~2063/16311MiB (all applications).
- GEO/FiveA/Brand Mind entry and return, both panels, all five stage scale/energy
  and four flowStrength renderer binding proofs pass. Canvas/RAF/wheel = 1/1/1;
  console/runtime errors = 0. Frozen source/assets and unrelated WIP untouched.
- Reproduce with `tools/earth-realism-v11-gate.cjs`,
  `tools/earth-realism-v11-evidence.py` and existing
  `tools/home-final-art-regression.cjs`; all image/report outputs remain in `art/`.
- **EARTH V1.1 READY FOR HUMAN REVIEW**, not HUMAN PASS or production replacement.
  At close range the existing city/cloud atlas resolution remains a visible limit.

## Earth Orbital V1.2 — independent human-review candidate

- Branch: `feat/home-earth-realism-v12-orbital`, independent worktree based on
  V1.1 `dccc33ee8fa075c14bce72bde477d0bde89aa706`, which includes verified latest
  integration `42b33bfc6e873e29cc6fb2b0e2a9fa992f101f66`. No Master merge or
  replacement of the HUMAN PASS / VISUAL FREEZE HOME baseline.
- Opt in with `earthOrbital=1&earthV2=1&earthV3=1`; B is selected. Three candidates
  compared, one visual correction (land direct response/saturation, cloud response,
  weak night bounce). No global exposure, bloom, camera, layout or rotation changes.
- Genuine 8K Solar System Scope / INOVE CC BY 4.0 maps deterministically become
  four 4K lossless runtime maps: albedo, normal/land, urban tiers, cloud scales.
  Original files stay in art; runtime attribution and content hashes are committed.
  Exact WebP preserves normal RGB under zero land-mask alpha. Historic assets intact.
- Geographic rough land, grazing dark ocean response, three night-city tiers with
  water exclusion/cloud occlusion, source-backed weather and thin cloud/ground
  interaction, eight-sample camera-relative Rayleigh/Mie-inspired atmosphere.
  Single-scattering approximation, not measured physical or offline ground truth.
- Same-camera 1600x900 DPR1 A/B and four layer views, 640x360 small read, three
  live parallax positions and 6.9-second actual runtime video saved under art/earth-v12.
  Closeup and HOME visibly improve weather/terrain/air separation; midnight remains
  deliberately dark. Human review is still required, especially on a darker display.
- Node: all 36 current test files / 44 runner cases PASS; Python visual 12 PASS;
  build and diff check PASS. Real Edge RTX 5060 Ti HOME 120.0 FPS, P95 8.4ms,
  53 draws; closeup 120.0 FPS, P95 8.5ms, 18 draws. Earth four draws in both.
  GPU whole-frame ~2.66ms HOME / 1.29ms closeup (not isolated Earth timing).
  Board VRAM ~1990/16311MiB HOME, includes other applications; texture mip estimate
  170.7MiB, not a dedicated process-memory measurement.
- GEO/FiveA/Brand Mind entry/return, two panels, five stage scale/energy and four
  flowStrength renderer binding proofs PASS. Console/runtime 0; Canvas/RAF/Wheel
  1/1/1. Frozen shader paths, Galaxy, bindings and unrelated WIP untouched.
- Audit: `EARTH_V12_ASSET_AUDIT.md`. Reproduce using earth-orbital asset/gate/evidence/
  motion tools and existing home-final-art-regression. No Blender was needed.
- **EARTH V1.2 READY FOR HUMAN REVIEW**. Candidate only; no HUMAN PASS claimed.

## Earth V1.2 Final Realism Polish — experiment, NOT READY

- Continues the safe pushed `802f3f560ac788f822d8e89ce756d7715660f2c7` on the same
  Earth feature branch; no Master integration or frozen HOME replacement.
- Three strategies compared, B selected, two bounded corrections completed.
  Geographic city tiers, nonlinear cloud transmission, local ray-projected shadows,
  source-based cloud relief, eight-step atmosphere sampling and night material
  separation improve closeup detail. Existing 4K asset bytes are unchanged.
- **NOT READY FOR PRODUCTION**: the exact-camera HOME crop does not show a
  sufficiently obvious improvement over 802f. Do not call it a final visual PASS.
  Do not continue polishing automatically or change composition to force a pass.
- All Node tests (47 runner cases), 12 Python visual tests, build and diff check
  PASS. Real GPU HOME/closeup ~120 FPS, P95 8.5ms, Earth 4 draws, HOME 53 draws.
  Existing entries, panels and FiveA renderer-binding proofs retained.
- Detailed reasoning and reproduction: `EARTH_V12_FINAL_POLISH.md`.
  Art, A/B, night crop, parallax and video evidence stay under `art/earth-v12-final/`.

## Earth V1.3 Orbital Ground-Truth Convergence — experimental, NOT READY

- Independent `feat/home-earth-realism-v13-ground-truth`, based on de43f5e;
  preserves 802f3f5 and HOME FINAL V1. Frozen Earth is not replaced.
- Real Blender 5.2 Cycles/OptiX reference using actual Web mesh/UV/camera/sun:
  64 samples, closeup 6.234s, HOME crop 4.419s. No new runtime texture assets.
- Four phases compared; original Asian phase retained. Three material profiles,
  B / 12-step atmosphere selected; one bounded night-body/cloud correction.
- Explicit `earthV13=1` plus existing orbital flags: geographic material separation,
  continuous cloud optical depth, bounded footprint compensation, very slow
  3600-second rotation. Old shader paths, composition and other modules unchanged.
- **EARTH ROUTE NOT READY / EARTH V1.3 NOT READY FOR PRODUCTION**: native HOME
  A/B improvement over 802f is still incremental, not the requested photographic
  step-change. No further correction or automatic version; no Master promotion.
- All Node 51 runner items and Python visual 12 PASS; build/diff PASS. HOME and
  closeup ~120 FPS, P95 8.5ms, Earth 4 draws, HOME 53. Console/runtime 0,
  Canvas/RAF/Wheel 1/1/1. Entries, two panels, FiveA stage/flow bindings PASS.
- Reference limits, GPU timing caveats, assets, A/B conditions and reproduction:
  `EARTH_V13_GROUND_TRUTH_AUDIT.md`. Review artifacts under `art/earth-v13/`.
  Local experimental checkpoint only; not pushed as a production candidate.

## Earth Hybrid Cinematic V1 — candidate for human review

- Independent `feat/home-earth-hybrid-cinematic-v1`, based on protected V1.3
  `7a8d71591e8fcab2ef4da62cb866a1e5c4694fb4`. HOME FINAL V1 remains frozen;
  no Master integration or automatic replacement.
- Cycles / OptiX candidate B: 2048-square 96-sample independent Surface, City,
  Cloud and reference Atmosphere passes. Existing legal 4K assets retained.
- Explicit `earthHybrid=1` creates an Earth-local 16-bit depth-derived body,
  independent slowly drifting cloud and existing live atmosphere: 3 draw calls.
  Real-time Earth retained as loading / out-of-view-cone fallback.
- Native HOME ROI visibly improves weather / ground separation over 802f and
  V13. This is READY FOR HUMAN REVIEW, not HUMAN PASS. Closeup is a capture-view
  inspection; no free-orbit capability is claimed.
- HOME ~120 FPS / P95 8.5ms / 52 draws; console/runtime 0, Canvas/RAF/Wheel 1/1/1.
  All 56 Node runner cases and 15 Python visual cases PASS, build/diff PASS.
  Three entries/returns, two panels, five Stage and four Flow bindings PASS.
- Scope, provenance, view limits, GPU caveats and reproduction are recorded in
  `EARTH_HYBRID_FEASIBILITY.md`. All screenshots, .blend, EXR reference passes,
  comparisons and video remain local under `art/earth-hybrid/`.
