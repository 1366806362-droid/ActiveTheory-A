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
