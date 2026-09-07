# ActiveTheory V2 Data Foundation

## Boundary

**V2-0 DOES NOT RENDER.**

The existing V1 renderer owns Three.js scenes, cameras, composition, routes,
handoff, interaction, shaders, particles, and final art direction. The V2 data
layer is a deterministic, renderer-independent source of bounded visual state.
It does not import `three`, create WebGL resources, or change V1 scene files.

## Data flow

```text
Source
  -> Adapter
  -> BrandUniverseSnapshot
  -> Derived Business Metrics
     |-> Data Panel ViewModel
     `-> Data-to-Visual Mapping
  -> Normalize (0..1)
  -> BrandUniverseVisualState
  -> VisualBindingPlan
  -> Renderer Adapter (V2-3B, future integration only)
  -> Three.js
```

## Canonical modules

- `metadata`: brand, snapshot, capture time, schema version, and explicit
  `REAL` / `MOCK` / `PARTIAL` source identity.
- `geo`: Answer, Citation, Keyword, and Signal Core measures with provenance,
  confidence, and verification status.
- `fiveA`: canonical A1-A5 stages, exactly four adjacent transitions, and a separate
  opportunity pool that is never treated as a sixth stage.
- `brandMind`: core measures, open associations, relationships, and explicit
  history availability. Missing history never creates a trend.

## Art-direction contract

Business data may control bounded state such as density, energy, flow,
emphasis, activity, node scale, and transition strength. It may not control
camera, object position, route, handoff, or overall composition. Guardrails keep
missing, negative, and extreme data from making the visual system disappear or
overrun the screen.

## V2 integration TODO

When the V1 renderer is integrated in a later phase, it should consume only the
validated `BrandUniverseVisualState`. No renderer integration is included in
V2-0.

## V2-1 source adapters

Explicit GEO, 5A, and Brand Mind source adapters convert source-specific
payloads into partial or full canonical snapshots. The adapter registry never
guesses a payload type. Every snapshot carries adapter, source, capture,
verification, and optional source-file lineage through to VisualState metadata.
MOCK identity and PARTIAL completeness are independent so isolated synthetic
fixtures remain clearly synthetic without pretending to be complete datasets.

## V2-1 canonical alignment

`consumerContracts.js` freezes the boundary between source fields, canonical
business facts, derived business metrics, and presentation fields. GEO uses the
current checked-in `GeoDashboardDataset` 1.0.0 / V1.6 runtime as its consumer
source contract. FiveA and Brand Mind use the frozen V1.1 Panel ViewModel input
contracts read from their remote checkpoint branches.

Adapters translate source fields, preserve lineage, and create explicit MISSING
points. They do not create panel copy, colors, bottleneck conclusions,
`coreStatus`, opportunity insights, or shader values. Pure functions under
`derived/` own reusable business derivation. Data Panel ViewModels and
VisualState mapping must consume the same validated Canonical Snapshot and may
not maintain conflicting business facts.

## V2-2 unified consumers

`runtime/consumerProvider.js` is the single runtime composition boundary for
current Canonical Snapshots. It validates the snapshot and consumer contract,
derives reusable business metrics once, and exposes the same snapshot to both
Panel ViewModels and `buildVisualState()`.

Panel modules receive `{ snapshot, derivedMetrics }` through dependency
injection. They never import source adapters and retain only labels, number
formatting, and presentation copy. FiveA bottleneck/drop-off rules and Brand
Mind core status/opportunity/diagnostic rules live only under `derived/`.
Replacing a MOCK source with a future REAL adapter output therefore changes the
provider input, not the Panel or Visual Mapping business facts.

## V2-3A visual binding contract

**V2-3A DOES NOT RENDER.** `binding/` translates validated VisualState fields
into a deterministic, serializable `VisualBindingPlan`. Stable channel IDs state
which future renderer-facing visual channel receives each bounded value, while
remaining independent of Three.js classes, scene objects, shaders, materials,
particles, and DOM implementation.

The binding layer is identity or bounded pass-through only. It reuses the
existing Art Direction guardrails, retains source-missing diagnostics and
lineage, preserves stable FiveA stage/transition IDs and Brand Mind association/
relationship IDs, and never recalculates business metrics. Capability contracts
make unsupported renderer channels an explicit validation error rather than a
silent omission.

Data may control bounded scale, density, energy, activity, flow, highlight, and
visibility. Camera, global composition, scene layout, Earth/Galaxy position,
permanent stage position, route, scroll, handoff, typography, and panel layout
remain exclusively owned by Art Direction and application interaction logic.

## V2-3A.1 replay and regression harness

`replay/` runs chronological canonical snapshots through the existing
`deriveBusinessMetrics()`, `buildVisualState()`, and `buildVisualBindingPlan()`
functions. It does not duplicate business rules or render anything. Each replay
frame retains snapshot identity, lineage, compact Panel/derived/visual/binding
summaries, and safety assertions. Scenarios verify directionality, stable IDs,
metadata, missing-data preservation, guardrail bounds, determinism, and JSON
serialization before future V2-3B renderer adapters exist.

Run the compact report with:

```text
node src/v2/replay/previewReplay.mjs
```

Golden fixtures intentionally record only stable IDs, frame IDs, and selected
expected categories. They do not snapshot full VisualState or renderer output.

## V2-3A.2 renderer adapter dry-run

**V2-3A.2 DOES NOT RENDER.** `renderer-dry-run/` is a pure Node execution
harness between `VisualBindingPlan` and a serializable `FakeRendererState`.
It consumes only the frozen V2-3A channel contract, resolves targets by stable
FiveA stage/transition IDs and Brand Mind association/relationship IDs, and
uses validate-first atomic apply. Failed channels, illegal values, and missing
targets leave the prior state intact. A rollback token restores the complete
prior state; re-applying a plan is an idempotent set operation.

Dynamic Brand Mind targets are never silently created from an incoming plan.
When a previously known dynamic target is absent from a later valid plan, the
dry-run policy marks it inactive. The final Three.js lifecycle decision remains
`V2-3B TODO`. Missing source data remains flagged in binding metadata while its
existing renderer-safe fallback value may still be applied.

Run the compact dry-run report with:

```text
node src/v2/renderer-dry-run/previewDryRun.mjs
```

## V2-3B preflight: real renderer target inventory

**This inventory does not render and does not import `three`.**
`renderer-inventory/` is the read-only bridge between the frozen V2 binding
channels and the current V1 scene implementation. It records a semantic target
ID, source file and symbol, lifecycle, capability status, required adapter hook,
and future implementation priority for every channel-to-target mapping.

It explicitly protects Art Direction ownership: camera, global composition,
scene layout, Earth/Galaxy position, permanent stage positions, route, scroll,
handoff, typography, and Panel layout are never inventory targets.

The current audit finds that Home, GEO, FiveA, and the Brand Mind Core have
stable semantic objects but no renderer-safe V2 setters (`NEEDS_ADAPTER_HOOK`).
Brand Mind association nodes and relationship paths are presently created by
scene-array order, rather than canonical `associationId` and
`sourceId + targetId` registries. They are therefore explicit P0
`DYNAMIC_TARGET` blockers; the preflight must remain `BLOCKED` until V2-3B
creates safe stable registries. The inventory does not attempt that work.

Run the compact preflight report with:

```text
node src/v2/renderer-inventory/previewRendererInventory.mjs
```

## V2-3B: opt-in FiveA A3 real renderer vertical slice

This explicitly scoped milestone connects **only A3 SCALE and ENERGY**. The
inventory above is a historical whole-project audit, not permission to bind
other stages, transitions, GEO, Home, or Brand Mind. Their adapters remain out
of scope. Brand Mind registry work on its separate branch is not merged here.

`runtime/fiveAA3Demo.js` derives deterministic LOW / BASELINE / HIGH / PARTIAL
synthetic snapshots from `CANONICAL_FIVE_A_MOCK`. One existing consumer provider
supplies the same snapshot and derived metrics to the panel and VisualState.
BindingPlan is built once on initialization, not each frame.

`renderer-adapters/fiveAA3RendererAdapter.js` consumes only the validated plan.
It selects exactly A3 scale and energy by stable channel + stage + target ID,
then validates both before writing. Other valid channels in the full plan are
intentionally not executed by this narrow capability. Missing paths and lineage
remain attached to the execution report. Invalid input leaves prior state intact;
write failure rolls back, reapply is idempotent, and dispose restores multipliers
to the original art values before releasing its target reference.

The real target is `FiveAStageNodeA3` plus the A3 slot in the existing
`FiveAStageGpuParticleSpheres` draw. Scale multiplies the existing node transform
and GPU point-size uniform (matrix translation is untouched). Energy multiplies
the existing A3 opacity uniform. No GLSL, colors, material construction, particle
counts, geometry, permanent positions, camera, route, or panel layout changes.
Density is deferred: the static batched geometry has no safe per-stage density
control. No second renderer, Canvas, RAF, or business-fact source is created.

Development URLs (Vite dev only):

```text
/?scene=fivea&v2FiveAA3State=low
/?scene=fivea&v2FiveAA3State=baseline
/?scene=fivea&v2FiveAA3State=high
/?scene=fivea&v2FiveAA3State=partial
```

No demo query / production builds preserve the unbound V1 art. For comparable
screenshots append `&v2FiveAA3Capture=1`: the existing single loop samples time
12 seconds with zero simulation delta (including drifting dust), without changing
its camera path or starting a second loop. Omit capture mode for interaction
tests: it intentionally freezes time-based transitions for screenshots. After
120 frames, a development-only `data-v2-five-a-a3-proof` document attribute
records canonical, VisualState, BindingPlan, actual GPU readback, camera, and RAF
chain count. It is removed on engine disposal. This is a one-time evidence
sample, not live performance telemetry or a new UI control.

```text
node src/v2/renderer-adapters/fiveAA3RendererAdapter.test.mjs --report
node src/engine/loop.test.mjs
```

The first command instantiates real Three.js scene objects in Node, stubbing only
2D label texture drawing, and writes local-only `art/v2-3b-fivea-a3/a3-values.json`.
It verifies actual matrices/uniforms, not just an adapter mock. Browser screenshots
and interaction observations complement these deterministic engineering tests;
they do not authorize a new visual art direction.

## V2-3B: FiveA A1-A5 stage expansion

This subsequent scoped milestone extends scale and energy to all five stable
stage IDs. `fiveAStageRendererAdapter.js` is the single implementation; the A3
adapter is a compatibility wrapper with an A3-only capability scope. The scene
registry resolves `A1` through `A5` directly; Opportunity Pool is not a target.
Density, activity, transitions, GEO and Brand Mind are not executed.

Every apply validates all ten entries before any write, rolls back on write
failure, and preserves lineage/missing metadata. GPU matrices are derived from
the last animation reference sample rather than the previous binding write,
preventing cumulative multiplication during repeated T1/T2/T3 switches.
Disposal restores the original art multipliers before scene disposal.

Development-only entry: `/?scene=fivea&v2FiveAState=balanced|contrast|partial`.
The stage query takes precedence over the legacy A3 query. All three fixtures
are explicit synthetic engineering scenarios, not coherent real funnel datasets;
transition and Opportunity facts deliberately stay unchanged to prove isolation.
The existing consumer provider supplies the identical snapshot to Panel and
VisualState. No pipeline work runs per frame. Normal/production entries remain
unbound. Append `&v2FiveACapture=1` only for frozen-time comparison screenshots;
omit it for interactions. The one-time `data-v2-five-a-stages-proof` attribute
records all five actual GPU readbacks after 120 frames and is removed on disposal.

Run `node src/v2/renderer-adapters/fiveAStageRendererAdapter.test.mjs --report`.
The 46 tests exercise real Three.js matrices/uniforms, per-stage isolation,
200 repeated snapshot cycles, animation updates, rollback, reopening and missing
values. Local reports and screenshots stay in `art/v2-3b-fivea-stages/`.

## V2-3B: A2_TO_A3 flow strength

`fiveAFlowRendererAdapter.js` selects one validated FLOW_STRENGTH entry by
transitionId/targetId/sourcePath. The real scene target is an endpoint-derived
subset of the existing `FiveACoreReleaseParticleFlow` batch, not a global
uniform or an array-index binding. It multiplies only existing aAlpha against
an unmodified CPU reference buffer. Apply is atomic, repeated writes do not
compound, and disposal restores the original multiplier before scene disposal.
No shader or geometry rebuild, and no new RAF. The original update computes
animation alpha each frame; business mapping runs only at snapshot apply.

Development URL: `/?scene=fivea&v2FiveAFlowState=low|baseline|high|partial`.
This query takes precedence over stage/A3 demos and enables both stage and flow
adapters using the same consumer provider. All stage source facts stay fixed.
`v2FiveAFlowFrame=0|1|2` freezes the existing loop at 12/12.25/12.5 seconds for
comparable evidence. Omit that parameter for Panel/ESC/Journey testing.
The development-only `data-v2-five-a-flow-proof` document attribute publishes
one runtime sample after 120 frames and is removed on disposal.

Fixtures use synthetic cohort entrants=1000 and observed exits=100/500/900;
rate is cohort exits/entrants, never a ratio of stage populations. PARTIAL
preserves null exits, volume and rate, with Mapping fallback strength=0.1.
An independent business strength metric is not supplied and stays missing;
the renderer flowStrength follows the existing rate Mapping, not this missing
source strength. Other transition facts are intentionally preserved, not
represented as belonging to the same tracked cohort. All scenarios are MOCK.

flowSpeed remains unbound. Formal Mapping uses volume, not conversion rate;
the present animation uses shared absolute time, so phase-continuous per-segment
speed requires a separately authorized change. Other transitions remain unbound.

Run `node src/v2/renderer-adapters/fiveAFlowRendererAdapter.test.mjs --report`.
Local actual-array and browser evidence: `art/v2-3b-a2-a3-flow/`.

FiveA Derived revision 2 preserves missing cohort in/out instead of replacing
them with stage populations. This fixes a pre-existing PARTIAL Panel mismatch;
the UI and formal rate-to-strength Mapping remain unchanged.

## V2-3B: Four FiveA transition flow strengths

`createFiveATransitionFlowRendererAdapter()` is the one stable-ID execution
adapter for `A1_TO_A2`, `A2_TO_A3`, `A3_TO_A4`, and `A4_TO_A5`. It accepts only
one `FLOW_STRENGTH` plan entry for each ID and resolves each entry against its
own existing transfer-flow particle subset. It does not use array ordering,
change shared animation time, alter particle paths, rebuild geometry, or write
shader parameters. The former A2_TO_A3 adapter remains a compatibility wrapper
with its original single-transition scope.

Development-only verification requires both query parameters:

```text
/?scene=fivea&v2FiveATransition=A1_TO_A2&v2FiveATransitionState=low|baseline|high|partial
```

Replace the transition ID with any of the other three adjacent transitions.
`v2FiveATransitionFrame=0|1|2` fixes the normal loop to 12/12.25/12.5 seconds
for comparable local evidence. Every scenario is explicitly MOCK/SYNTHETIC.
Only the selected transition receives a tracked cohort of 1000 entrants:
100/500/900 observed exits for LOW/BASELINE/HIGH, or null observations for
PARTIAL. Conversion rate is exits divided by that cohort, never a ratio of
stage snapshot populations. The provider supplies the exact same canonical
snapshot to the panel, VisualState, BindingPlan and renderer adapter.

`flowSpeed` and density are deliberately unbound. The current path animation
uses shared absolute time; changing per-segment speed safely requires a future
phase-continuity design. Missing values retain their diagnostic metadata and
use the established renderer-safe strength fallback without becoming facts.

Run `node src/v2/renderer-adapters/fiveATransitionFlowRendererAdapter.test.mjs
--report` for real shared-batch alpha readbacks, atomic rollback, idempotence,
per-transition isolation and disposal coverage. The optional report is local
only under `art/v2-3b-fivea-transitions/`.
