# WORKLOG

This log records the current state, progress, and observations of the project.
Use it to track what works, what doesn’t, and what to do next.

---

## [2026-01-16] Advanced Physics & Realism

**Branch / Feature:** `feature/advanced-physics`

### 1. Current State (Advanced Physics & Realism)

- [x] **Aerodynamics:** Implemented a triangle-based Lift/Drag model. The cloth now flutters naturally when moved, rather than feeling like it is submerged in liquid.
- [x] **Coulomb Friction:** Replaced the "Sticky Shoulder" hack with a true Static/Kinetic friction model. The shirt stays on due to normal force and tension, not artificial locks.
- [x] **Asymmetric Proxy Bias:** Implemented a "Virtual Foam" layer (12mm soft offset) to smooth out the jagged low-poly collider. This eliminated the "Lateral Lean" drift where the shirt would slide sideways on its own.
- [x] **Stability:** The simulation remains rock-solid at 60 FPS. The combination of Interleaved Solving and Cached Contacts has proven to be the correct architecture for web-based physics.

### 2. Not Working / Issues (Advanced Physics & Realism)

- [ ] **Fitting:** We still lack a proper fitting phase. Tight garments rely on the "Airbag" (Velocity Clamp) to push them out, which works for t-shirts but might fail for skinny jeans or leggings.

### 3. Observations / Notes (Advanced Physics & Realism)

- **Friction Tuning:** We found that a high Static Friction (0.7) combined with a moderate Kinetic Friction (0.4) gives the best "Cotton" feel. Lower values make it feel like Silk.
- **Visual Offset:** The 12mm collision offset creates a visible gap between the cloth and body. This is necessary for physics stability but should be visually hidden by scaling the visual mesh or using a displacement shader in the future.

### 4. Next Steps / Plan (Advanced Physics & Realism)

- [ ] **Fitting Pipeline:** Implement the "Hulk" growth strategy to support tight-fitting garments.
- [ ] **WebGPU:** Begin research into porting the solver to Compute Shaders for next-gen density.

## [2026-01-16] Penetration Resolution & Performance Optimization

**Branch / Feature:** `feature/penetration`

### 1. Current State (Penetration Resolution & Performance Optimization)

- [x] **Robust Collision:** Implemented a "Defense in Depth" strategy.
  - **Velocity Clamping:** Prevents high-speed particles from tunneling through the mesh.
  - **Interleaved Solver:** Moves collision resolution *inside* the constraint loop. This eliminated the "fighting" between cloth stiffness and body collision, resulting in zero jitter.
  - **Signed Distance Logic:** Replaced simple distance checks with dot-product projection for accurate "Inside/Outside" determination.
- [x] **Performance Restoration:** Optimized the collision loop by implementing **Cached Contacts** and **Zero-Allocation Queries**.
  - Reduced Spatial Hash queries from ~270,000/frame to ~27,000/frame.
  - Restored smooth 60 FPS performance while maintaining high solver iteration counts (10 substeps × 10 iterations).
- [x] **Simulation Quality:** The cloth now feels "solid." It resists penetration even when dragged against the body, and the "rubbery" stretching is completely gone due to the high iteration count.

### 2. Not Working / Issues (Penetration Resolution & Performance Optimization)

- [ ] **Visuals:** The cloth rendering is currently basic (standard material). It lacks the anisotropic sheen of real fabric.
- [ ] **Fitting:** The shirt still spawns in its final position. Tighter garments might need a "growth" phase to settle correctly.

### 3. Observations / Notes (Penetration Resolution & Performance Optimization)

- **Optimization Lesson:** In WASM/Rust, memory allocation (creating `Vec` inside a loop) is the silent killer. Switching to a reusable `query_buffer` passed down the stack yielded a massive performance gain.
- **Physics Insight:** "Solving collision as a constraint" is superior to "Post-process collision." By treating the body surface as just another constraint (like a distance spring), the XPBD solver finds a stable equilibrium naturally.

### 4. Next Steps / Plan (Penetration Resolution & Performance Optimization)

- [ ] **Visual Polish:** Implement custom shaders for fabric rendering.
- [ ] **Fitting Pipeline:** Implement the "Hulk" growth strategy for tight-fitting garments.

## [2026-01-16] Self Collision Implementation

**Branch / Feature:** `feature/self-collision`

### 1. Current State (Self Collision Implementation)

- [x] **Self Collision:** Implemented a basic self-collision system using a spatial hash and adjacency list to ignore connected neighbors.
- [x] **Interaction Isolation** Implemented `OrbitControls` toggle. When the user grabs the cloth, camera rotation should lock.
- [x] **Anisotropic Bending** Real fabric bends easily along the weft/warp lines but resists diagonal bending. We upgraded the Bending Constraint to respect the UV directions of the mesh.

### 2. Not Working / Issues (Self Collision Implementation)

- [ ] **Penetration:** The cloth can penetrate the body mesh. We need to implement a proper collision system.

## [2026-01-16] Architecture Migration & Physics Stabilization

**Branch / Feature:** `main`

### 1. Current State (architecture migration)

- [x] **Architecture:** Successfully migrated to a Hexagonal Architecture. The Rust Physics Core is fully decoupled from the React Frontend via the `ISimulationEngine` adapter interface.
- [x] **Collision System:** Replaced the problematic Voxel SDF with a **Smoothed Mesh Proxy**. The cloth now slides smoothly over the low-poly mannequin without "ratcheting" or "life-preserver" artifacts.
- [x] **Dynamics:** Implemented an XPBD (Extended Position Based Dynamics) solver.
  - **Stiffness:** Achieved a stable "Denim/Cotton" feel by using `0.0` compliance (Rigid) combined with 10 internal solver iterations.
  - **Stability:** The "Rubber Shirt" effect is gone.
- [x] **Topology:** Fixed the "detaching cuffs" issue by increasing the vertex weld threshold to `1cm` (0.01) in the `GeometryProcessor`, ensuring the garment is a single cohesive mesh.
- [x] **Interaction:** Implemented a `MouseConstraint` in Rust. Users can now grab, pull, and drag the fabric in real-time.
- [x] **Performance:** Running smoothly at 60 FPS on desktop via Zero-Copy WASM memory synchronization.

### 2. Not Working / Issues (architecture migration)

- [ ] **Interaction Conflict:** Clicking to drag the shirt also triggers the `OrbitControls`, causing the camera to rotate wildly while pulling the fabric.
- [ ] **Lateral Bias:** The shirt occasionally exhibits a slight drift to one side when resting. This is likely due to asymmetric triangulation in the low-poly mannequin proxy.
- [ ] **Extreme Force Tunneling:** Pulling the shirt with unrealistic force can cause it to clip through the body mesh (tunneling).
- [ ] **Self-Collision:** The shirt does not collide with itself. Sleeves can pass through the torso, and folds can intersect.

### 3. Observations / Notes (architecture migration)

- **Solver Tuning:** We learned that increasing **Solver Iterations** (math-only loops) is significantly more efficient for creating stiff fabrics than increasing **Substeps** (full engine loops). 10 iterations per substep gave us the rigidity of "Chainmail" without the CPU cost.
- **Collision Strategy:** The "Smoothed Normal" trick (barycentric interpolation) on a low-poly proxy is the "magic bullet" for real-time character physics. It provides the smoothness of an infinite-resolution capsule with the anatomical accuracy of a mesh.
- **Blender Export:** GLTF exporters often split vertices at UV seams. Aggressive vertex welding in the `GeometryProcessor` is mandatory to prevent the physics mesh from falling apart at the seams.

### 4. Next Steps / Plan (architecture migration)

- [ ] **Interaction Isolation** Implement an `OrbitControls` toggle. When the user grabs the cloth, camera rotation should lock. This is a UX necessity.
- [ ] **Visual Fidelity** Implement a custom shader for the cloth that supports Anisotropic Lighting (to simulate the weave of fabric) and Normal Mapping to add high-frequency detail (wrinkles) that the physics mesh cannot support.
- [ ] **Spatial Hashing for Self-Collision** Implement a secondary Spatial Hash specifically for the garment vertices. To maintain performance, this should likely run on a separate thread or at a lower frequency than the main solver.
- [ ] **Anisotropic Bending** Real fabric bends easily along the weft/warp lines but resists diagonal bending. We should upgrade the Bending Constraint to respect the UV directions of the mesh.
- [ ] **WebGPU Compute Shaders** Port the `solver.rs` logic to WGSL. This will unlock the ability to simulate high-density meshes (>10,000 vertices) by parallelizing constraint solving.
- [ ] **Fitting Pipeline** Re-introduce the "Hulk" growth strategy (animating body scale from 0.8 to 1.0) to allow tight garments to settle naturally without initial intersection.
