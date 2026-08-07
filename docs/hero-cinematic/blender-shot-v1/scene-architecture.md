# Scene architecture

The scene is generated from JSON and contains twelve stable collections: cameras, background, far and mid stars, near passes, cosmic flow, galaxy proxy, dust, volume bounds, lights, handoff anchors and debug references.

All company-render geometry is low-complexity. Volume objects are wireframe bounds with render disabled. Far and mid stars use two deterministic triangle meshes instead of per-star objects. Near-pass and flow paths are low-bevel curves. The home preset is stored but never activated.

V1.1 keeps twelve near-pass curves but assigns deterministic active frame windows: none at frame 1, two at frame 30, seven at frame 78, eight at frame 145, two at frame 198, and none during frames 227–240. Cosmic flow is organized as two main paths plus two support paths, all directed toward the off-axis galaxy region without a central tunnel.

Blender uses Z-up and a camera looking down local negative Z. Browser handoff must convert into Three.js Y-up before applying position, target and quaternion.
