# WORKLOG

This log records the current state, progress, and observations of the project.
Use it to track what works, what doesn’t, and what to do next.

---

## [2026-01-16] Self Collision Implementation

**Branch / Feature:** `feature/self-collision`

### 1. Current State [2026-01-16]

- [x] **Self Collision:** Implemented a basic self-collision system using a spatial hash and adjacency list to ignore connected neighbors.
- [x] **Interaction Isolation** Implemented `OrbitControls` toggle. When the user grabs the cloth, camera rotation should lock.
- [x] **Anisotropic Bending** Real fabric bends easily along the weft/warp lines but resists diagonal bending. We upgraded the Bending Constraint to respect the UV directions of the mesh.

### 2. Not Working / Issues [2026-01-16]

- [ ] **Penetration:** The cloth can penetrate the body mesh. We need to implement a proper collision system.

## [2026-01-16] Architecture Migration & Physics Stabilization

**Branch / Feature:** `main`

### 1. Current State [2026-01-16](architecture migration)

- [x] **Architecture:** Successfully migrated to a Hexagonal Architecture. The Rust Physics Core is fully decoupled from the React Frontend via the `ISimulationEngine` adapter interface.
- [x] **Collision System:** Replaced the problematic Voxel SDF with a **Smoothed Mesh Proxy**. The cloth now slides smoothly over the low-poly mannequin without "ratcheting" or "life-preserver" artifacts.
- [x] **Dynamics:** Implemented an XPBD (Extended Position Based Dynamics) solver.
  - **Stiffness:** Achieved a stable "Denim/Cotton" feel by using `0.0` compliance (Rigid) combined with 10 internal solver iterations.
  - **Stability:** The "Rubber Shirt" effect is gone.
- [x] **Topology:** Fixed the "detaching cuffs" issue by increasing the vertex weld threshold to `1cm` (0.01) in the `GeometryProcessor`, ensuring the garment is a single cohesive mesh.
- [x] **Interaction:** Implemented a `MouseConstraint` in Rust. Users can now grab, pull, and drag the fabric in real-time.
- [x] **Performance:** Running smoothly at 60 FPS on desktop via Zero-Copy WASM memory synchronization.

### 2. Not Working / Issues [2026-01-16] (architecture migration)

- [ ] **Interaction Conflict:** Clicking to drag the shirt also triggers the `OrbitControls`, causing the camera to rotate wildly while pulling the fabric.
- [ ] **Lateral Bias:** The shirt occasionally exhibits a slight drift to one side when resting. This is likely due to asymmetric triangulation in the low-poly mannequin proxy.
- [ ] **Extreme Force Tunneling:** Pulling the shirt with unrealistic force can cause it to clip through the body mesh (tunneling).
- [ ] **Self-Collision:** The shirt does not collide with itself. Sleeves can pass through the torso, and folds can intersect.

### 3. Observations / Notes [2026-01-16] (architecture migration)

- **Solver Tuning:** We learned that increasing **Solver Iterations** (math-only loops) is significantly more efficient for creating stiff fabrics than increasing **Substeps** (full engine loops). 10 iterations per substep gave us the rigidity of "Chainmail" without the CPU cost.
- **Collision Strategy:** The "Smoothed Normal" trick (barycentric interpolation) on a low-poly proxy is the "magic bullet" for real-time character physics. It provides the smoothness of an infinite-resolution capsule with the anatomical accuracy of a mesh.
- **Blender Export:** GLTF exporters often split vertices at UV seams. Aggressive vertex welding in the `GeometryProcessor` is mandatory to prevent the physics mesh from falling apart at the seams.

### 4. Next Steps / Plan

- [ ] **Interaction Isolation** Implement an `OrbitControls` toggle. When the user grabs the cloth, camera rotation should lock. This is a UX necessity.
- [ ] **Visual Fidelity** Implement a custom shader for the cloth that supports Anisotropic Lighting (to simulate the weave of fabric) and Normal Mapping to add high-frequency detail (wrinkles) that the physics mesh cannot support.
- [ ] **Spatial Hashing for Self-Collision** Implement a secondary Spatial Hash specifically for the garment vertices. To maintain performance, this should likely run on a separate thread or at a lower frequency than the main solver.
- [ ] **Anisotropic Bending** Real fabric bends easily along the weft/warp lines but resists diagonal bending. We should upgrade the Bending Constraint to respect the UV directions of the mesh.
- [ ] **WebGPU Compute Shaders** Port the `solver.rs` logic to WGSL. This will unlock the ability to simulate high-density meshes (>10,000 vertices) by parallelizing constraint solving.
- [ ] **Fitting Pipeline** Re-introduce the "Hulk" growth strategy (animating body scale from 0.8 to 1.0) to allow tight garments to settle naturally without initial intersection.
