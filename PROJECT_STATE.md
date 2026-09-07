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

## Confirmed / frozen (continued)

- **V2-3B preflight inventory:**
  `5f5bd3c` on `feat/active-theory-v2-renderer-target-inventory` inventories 46
  binding channels and 27 observed runtime targets. It is a read-only,
  non-rendering checkpoint.
- **V2-3B.0 Brand Mind Stable Target Registry:** the follow-up branch establishes
  explicit `associationId -> runtime node` and ordered
  `sourceId + targetId -> runtime path` mappings in the live scene. It changes
  no visual value, shader, particle, position, camera, route, or panel layout.

## Not ready

- **Actual V2-3B renderer binding is not started.** The Brand Mind stable-ID
  preflight is READY, but all 27 observed renderer targets still explicitly
  require bounded adapter hooks. Any real adapter must consume the registries,
  preserve Art Direction ownership, and be separately approved.
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

1. Hand off the actual V2-3B renderer-adapter scope for separate approval;
   no adapter should start merely because preflight is READY.
2. HOME remains responsible for high-load visual work and human visual review.
