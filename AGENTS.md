# ActiveTheory Engineering Policy

## Operating modes

- **COMPANY** work is limited to source, contracts, tests, configuration, low-load
  validation, and Git hygiene. Do not run Cycles, OptiX, high-sample rendering,
  full image sequences, or other high-load visual production here.
- **HOME** is the only environment for approved high-load visual rendering. A
  completed technical test is not visual approval.

## Git and worktree safety

- Audit the actual branch, worktree, tracking state, and changed paths before
  each mutation. Preserve unrelated tracked WIP and all untracked art, QA,
  cache, archive, and render assets.
- Never use `reset`, `clean`, `stash`, `restore`, destructive checkout, rebase,
  force push, or a force pull to make progress. Do not merge `main` or `master`
  without explicit approval.
- Stage only an explicit path allowlist. Review the cached name list and run
  `git diff --cached --check` before committing. Use ordinary pushes only.

## V2 data and renderer boundaries

- The Canonical Snapshot is the one business-truth boundary:
  `Source -> Adapter -> Canonical Snapshot -> Derived Metrics -> (Panel and
  Visual Mapping) -> VisualState -> VisualBindingPlan`.
- Panels, VisualState, and renderer adapters must not reimplement conflicting
  business facts. Preserve source identity, lineage, verification, completeness,
  and `MOCK` / `PARTIAL` status; never silently promote or infer them.
- FiveA has exactly A1-A5. Opportunity Pool is not A6.
- Brand Mind associations use `associationId`; relationships use the ordered
  `sourceId + targetId` identity. Never bind them by transient array index.
- Binding data may affect bounded emphasis, scale, density, energy, activity,
  flow, highlight, or visibility only. Art Direction owns camera, composition,
  scene layout, Earth/Galaxy and permanent-node positions, route, scroll,
  handoff, typography, and Panel layout.

## Validation and fallback policy

- Tests, builds, dry-runs, and browser smoke checks validate engineering
  behavior; they do not certify visual quality. Visual changes require explicit
  human approval and must never overwrite approved art automatically.
- Unsupported, missing, or invalid data must remain explicit. Use the declared
  safe policy, never a silent fallback or guessed renderer target.
- Dispose lifecycle-owned listeners, RAF work, and scene resources. Keep a
  single Canvas and a single primary render loop unless a reviewed design says
  otherwise.
