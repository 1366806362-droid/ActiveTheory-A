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
  -> Renderer (future integration only)
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
