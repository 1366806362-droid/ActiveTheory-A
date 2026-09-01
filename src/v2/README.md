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
  -> Normalize (0..1)
  -> Data-to-Visual Mapping
  -> BrandUniverseVisualState
  -> Renderer (future integration only)
```

## Canonical modules

- `metadata`: brand, snapshot, capture time, schema version, and explicit
  `REAL` / `MOCK` / `PARTIAL` source identity.
- `geo`: Answer, Citation, Keyword, and Signal Core measures with provenance,
  confidence, and verification status.
- `fiveA`: canonical A1-A5 stages, A1->A5 transitions, and a separate
  opportunity pool that is never treated as a sixth stage.
- `brandMind`: core strength/concentration and an open association list.

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
