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
