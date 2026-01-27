# WORKLOG

This log records the current state, progress, and observations of the project.
Use it to track what works, what doesn’t, and what to do next.

---

## [2026-01-27] Visual Polish & Measurement Strategy

**Branch / Feature:** `fix/visual-artifacts` -> `feat/real-world-measurements`

### 1. Current State (Visual Polish)

- [x] **Procedural Textures:** Implemented `TextureGenerator` to create high-quality "Cotton Weave" normal maps in-memory.
- [x] **Material Tuning:** Fixed the "LCD Glow" and "Black Abyss" artifacts.
  - **Color Space:** Forced `NoColorSpace` on the normal map to prevent double-gamma correction.
  - **Material:** Reverted to `MeshStandardMaterial` for stability.
  - **Lighting:** Added a `HemisphereLight` to fill shadows and prevent pitch-black folds.
- [x] **Visual Parity:** The cloth now looks like matte cotton rather than plastic or glowing neon.

### 2. Observations / Notes (Physics & Sizing)

- **The "Tin Can" Effect:** Oversized shirts (XL/XXL) look rigid and puffed.
  - **Diagnosis:** The bending constraints are too stiff for the larger surface area. The square-cube law implies that as the shirt gets bigger, it gets heavier, but our stiffness parameter remains constant. The shirt supports its own weight like a rigid shell instead of draping.
- **Sizing Mismatch:** The current "L" is too big for the mannequin, while "XS" fits perfectly. We are guessing scales (0.92, 1.08) rather than using data.

### 3. Next Steps / Plan (Real-World Measurements)

- [ ] **Measurement Service:** Implement a service to parse real-world dimensions (Height, Chest, Waist).
- [ ] **Body Resizing:** Procedurally scale the mannequin to match input measurements (e.g., "Make this body 180cm tall with a 100cm chest").
- [ ] **Garment Matching:** Select and scale the garment based on its metadata (e.g., "This GLB is a Size M, 72cm length") to fit the generated body.

## [2026-01-26] Visual-Physics Parity & Orientation Fixes

**Branch / Feature:** `fix/visual-physics-parity`

### 1. Current State (Visual-Physics Parity)

- [x] **Adaptive Collider Pipeline:** Implemented a "Smart Decimation" strategy in `ProxyGenerator`.
  - **Logic:** If a mesh is under 5,000 triangles, it bypasses decimation and smoothing entirely.
  - **Result:** The Physics Collider now matches the Visual Mesh vertex-for-vertex. This eliminated the "Invisible Gap" caused by Laplacian shrinkage, allowing us to reduce collision thickness from 20mm to 5mm.
- [x] **Configurable Physics:** Updated the Rust engine to accept `smoothing_iterations` and `inflation_amount` as runtime parameters.
  - **Mannequin:** 0 Smoothing, 0 Inflation.
  - **Cloth:** 3 Smoothing passes (for stiffness).
- [x] **Voting-Based Orientation:** Replaced the fragile "Toe Check" with a robust **3-Factor Voting System** (Nose, Chest, Toes) to determine mesh orientation. This fixed the "Backward Mannequin" issue permanently.
- [x] **Physics Tuning:**
  - **Thickness:** Reduced to `0.005` (5mm) for a tight fit.
  - **Aerodynamics:** Reduced `lift_coeff` to `0.001` to eliminate armpit flapping.
  - **Friction:** Lowered to `0.3` to allow natural draping.
- [x] **Visuals:** Switched `MannequinMesh` to render the high-quality geometry with a "Clay" material, removing the "Terminator" wireframe look.

### 2. Observations / Notes (Visual-Physics Parity)

- **The "Double Buffer" Trap:** We discovered that combining **Mesh Inflation** (Geometry) with **High Solver Thickness** (Force) creates a "Space Suit" effect where the cloth floats 2-3cm off the body.
- **The Solution:** By ensuring the physics mesh is identical to the visual mesh (Raw Passthrough), we could trust the geometry and rely on a minimal solver thickness (5mm) just to prevent clipping.
- **Aerodynamic Instability:** High lift coefficients in static simulations cause "fluttering" in concave areas (armpits) because the solver interprets micro-jitters as wind velocity. Killing the lift force stabilized the simulation.

### 3. Next Steps / Plan

- [ ] **Fit Visualization:** Implement a Strain/Tension heatmap to visualize tight areas.
- [ ] **Ghost Collider:** Implement the "Growth" phase to handle A-Pose vs T-Pose arm intersections.

## [2026-01-22] Asset Pipeline & Pose Normalization

**Branch / Feature:** `feat/asset_preparation`

### 1. Current State (Asset Pipeline & Pose Normalization)

- [x] **Modular Asset Loader:** Refactored the monolithic `AssetLoader` into a scalable service architecture (`asset_loader/` directory).
  - `MeshLoader`: Handles GLTF loading and World Transform baking (fixing "Flipped" meshes).
  - `ProxyGenerator`: Encapsulates `meshoptimizer` logic for generating physics colliders.
  - `PoseNormalizer`: New service for correcting mesh orientation.
- [x] **Statistical Pose Correction:** Implemented a robust strategy to straighten leaning avatars without skeletal rigging.
  - **Robust Median Analysis:** Replaced bounding box centers with median coordinate filtering. This allows the engine to find the true torso center while mathematically ignoring asymmetric arms or hands.
  - **Symmetry Optimization:** Implemented a "Mirror Test" algorithm that iteratively rotates the mesh to find the angle of maximum bilateral symmetry, fixing lateral lean.
- [x] **Neck-Based Alignment:** Updated `AutoAligner` to anchor garments specifically to the **Neck**, rather than the Chest or Waist. This ensures the collar always sits correctly, even if the body leans.

### 2. Not Working / Issues (Asset Pipeline & Pose Normalization)

- [ ] **Sleeve Intersection:** While the torso alignment is now perfect, the arms of the SAM3D mesh (A-Pose) often intersect the torso of the Shirt mesh (T-Pose) during initialization. Because the arm starts *inside* the shirt body, the physics engine pushes the cloth outward, leaving the sleeve empty.

### 3. Observations / Notes (Asset Pipeline & Pose Normalization)

- **Geometric vs. Skeletal:** We confirmed that SAM3D meshes do not export a usable `SkinnedMesh` skeleton for web use. Therefore, all pose correction must be done via **Geometric Analysis** (analyzing vertex clouds) rather than FK/IK.
- **The "Ghost" Necessity:** Static alignment has reached its limit. We cannot mathematically align a $30^\circ$ arm into a $90^\circ$ sleeve without deforming the mesh. The solution must be dynamic: starting the simulation with a thinner body ("Ghost") and inflating it.

### 4. Next Steps / Plan (Asset Pipeline & Pose Normalization)

- [ ] **Ghost Collider Strategy:** Implement a pre-simulation phase where the collider is initialized at `scale=0.8` and linearly interpolated to `scale=1.0` over 60 frames. This will allow the shirt to fall *over* the arms before they expand to fill the sleeves.

## [2026-01-21] Physics Optimization & Tuning

**Branch / Feature:** `feat/cpu_optimization`

### 1. Current State (Physics Optimization & Tuning)

- [x] **Static Spatial Partitioning:** Implemented `StaticSpatialHash` (Dense Grid) for the body collider.
  - Replaced the `HashMap` implementation with a flattened `Vec<Vec<usize>>` for $O(1)$ lookups.
  - The body hash is now built **once** at startup, eliminating ~300,000 redundant hash insertions per second.
- [x] **Broad Phase Caching:** Refactored `CollisionResolver` to split Broad and Narrow phases.
  - **Broad Phase:** Runs once per frame (Substep 0). Queries the Static Hash and caches candidate triangles.
  - **Narrow Phase:** Runs every substep (Substeps 1-4). Checks distance against the *cached* candidates only.
  - **AABB Pruning:** Particles outside the Body's global bounding box now skip the spatial query entirely.
- [x] **Solver Tuning:** Leveraged the performance gains to increase realism.
  - **Iterations:** Increased from 4 -> **15**. This restored the stiffness of the fabric, fixing the "Rubber Shirt" effect caused by the previous aggressive optimization.
  - **Compliance:** Set to `0.0` (Rigid) to minimize stretching.
- [x] **Code Refactoring:** Split the monolithic `collision` module into focused sub-modules (`spatial_hash/`, `resolver/`, `preprocessing.rs`).

### 2. Not Working / Issues (Physics Optimization & Tuning)

- [ ] **Neckline Stretching:** While the fabric is stiffer, oversized shirts still exhibit elongation at the neck due to gravity acting on the loose mesh. The solver iterations (15) are insufficient to propagate the tension fully across the mesh in a single frame.

### 3. Observations / Notes (Physics Optimization & Tuning)

- **Performance ROI:** The Static Hash split was the single biggest performance win in the project's history. By removing the overhead of rebuilding the body grid, we freed up enough CPU budget to nearly quadruple the solver iterations (4 -> 15) while maintaining 60 FPS.
- **Optimization Strategy:** "Do Less Work" (Caching/Pruning) proved superior to "Do Worse Work" (Reducing Substeps). We maintained the simulation frequency but stripped away the redundant math.

### 4. Next Steps / Plan (Physics Optimization & Tuning)

- [ ] **Tether Constraints:** Implement "Long-Range Attachments" to mathematically lock the maximum length of the shirt (Neck to Hem), curing the stretching issue without costing CPU cycles.
- [ ] **Dual-Mesh Pipeline:** Begin work on the Skinning System to render high-poly assets driven by the optimized low-poly physics.

## [2026-01-20] Anatomical Alignment & Collider Pipeline

**Branch / Feature:** `feature/optimization-and-alignment`

### 1. Current State (Anatomical Alignment & Collider Pipeline)

- [x] **Anatomical Slicer:** Replaced the fragile AABB-based alignment with a robust "Slicer" algorithm (`MeshAnalyzer`).
  - **Spine Detection:** Accurately identifies the spine axis by analyzing the chest slice (Neck - 15%), ignoring belly protrusion.
  - **Neck Anchor:** Detects the true neck height based on mesh topology rather than bounding box max height.
  - **Result:** Fixed the "Sleeve Miss" issue on plus-size bodies; garments now spawn correctly centered on the torso.
- [x] **Procedural Collider Generation:** Implemented a "Decimate + Smooth" pipeline.
  - **Meshoptimizer:** Used WASM-based Quadric Error Metrics to reduce 100k-poly scans to ~5k-poly proxies.
  - **Laplacian Smoothing:** Implemented a 3-pass smoothing filter in Rust to remove decimation spikes.
  - **Compaction:** Added vertex buffer compaction to ensure zero wasted memory in the physics engine.

### 2. Not Working / Issues (Anatomical Alignment & Collider Pipeline)

- [ ] **Performance Bottleneck:** The simulation runs at ~20-30 FPS on the decimated mesh. Profiling indicates the bottleneck is the **Spatial Hash Rebuild**. We are currently rebuilding the static body's hash grid every single frame, which is $O(N)$ redundant work.

### 3. Observations / Notes (Anatomical Alignment & Collider Pipeline)

- **Alignment Strategy:** Geometric centers are not anatomical centers. The "Slicer" approach is far more robust for VTO than Bounding Boxes because it respects the skeletal structure of the user.
- **Optimization Strategy:** We are choosing *not* to lower the solver quality (Substeps/Iterations) to fix the lag. Instead, we will attack the architectural inefficiency (redundant hash rebuilding). This preserves the "High Fidelity" fabric feel while solving the frame rate issue.

### 4. Next Steps / Plan (Anatomical Alignment & Collider Pipeline)

- [ ] **Static Spatial Hash:** Split the collision detection into two phases:
    1. **Static Hash:** Built once at startup for the Body.
    2. **Dynamic Hash:** Rebuilt every frame for the Cloth.
- [ ] **AABB Pruning:** Implement a broad-phase check to skip narrow-phase collision logic for particles outside the body's bounding box.

## [2026-01-19] Asset Pipeline Automation

**Branch / Feature:** `feature/auto-alignment`

### 1. Current State (Asset Pipeline Automation)

- [x] **Automatic Alignment:** Implemented `AutoAligner` service.
  - **Body Normalization:** Automatically detects the feet (min Y) and centers the body on the floor at (0,0,0).
  - **Garment Snapping:** Automatically detects the shirt collar height and aligns it to the mannequin's neck (approx 88% height). This works even for imported meshes with arbitrary offsets.
- [x] **Transform Fixes:** Updated `AssetLoader` to respect GLTF scene graph transforms (Rotation/Scale). This fixed the issue where some exported avatars appeared upside down or rotated 90 degrees.
- [x] **State Stability:** Refactored the `simulationStore` to use **Immutable Assets**.
  - Fixed the "Shrinking Shirt" bug where switching sizes repeatedly would compound the scaling on already-scaled vertices.
  - The store now maintains a pristine copy of the T-Pose geometry and generates a fresh scaled copy for every size change.

### 2. Not Working / Issues (Asset Pipeline Automation)

- [ ] **Tight Fit Initialization:** While sizing works, selecting a size smaller than the body (e.g., XXS on a large mannequin) still causes initial intersection. The physics engine resolves this, but it can be visually jarring.

### 3. Observations / Notes (Asset Pipeline Automation)

- **Pipeline Robustness:** By moving the alignment logic from Blender to Code, we have significantly reduced the "Technical Artist" workload. We can now drop in raw GLB files from different sources, and the engine standardizes them automatically.
- **TypeScript Safety:** Fixed a critical Control Flow Analysis bug in the loader where TypeScript incorrectly assumed the mesh variable was null inside a callback.

### 4. Next Steps / Plan (Asset Pipeline Automation)

- [ ] **Template Morphing:** Begin research on the "Shrink-Wrap" pipeline to fit our clean mannequin onto user-uploaded body scans.
- [ ] **Fit Visualization:** Implement the Strain Heatmap.

## [2026-01-16] Garment Grading & Sizing

**Branch / Feature:** `feature/sizing`

### 1. Current State (Garment Grading & Sizing)

- [x] **Garment Grading:** Implemented a robust sizing system supporting sizes from **XXS to XXL**.
  - **Pivot Logic:** Solved the "floating shirt" issue by implementing a custom pivot strategy. Width scales from the center, but Height scales from the **Top (Neck)**. This ensures the collar always rests on the mannequin's shoulders, regardless of whether the shirt is tiny or huge.
  - **Stability:** Fixed the "disappearing shirt" bug by ensuring the physics engine is fully disposed and re-initialized when switching sizes.
- [x] **UI Controls:** Added a responsive UI to switch sizes in real-time.
- [x] **Visual Verification:** Confirmed that "L" matches the original Blender export, "XXS" is visibly tighter, and "XXL" is looser and longer.

### 2. Not Working / Issues (Garment Grading & Sizing)

- [ ] **Tight Fit Initialization:** Selecting "XXS" on the current mannequin causes the shirt to spawn *inside* the body. The physics engine resolves this via the "Airbag" (Velocity Clamp), but it can look violent for a split second. This confirms the need for the "Ghost Collider" fitting pipeline in the future.

### 3. Observations / Notes (Garment Grading & Sizing)

- **Pivot Importance:** Standard uniform scaling `mesh.scale.set(s,s,s)` is insufficient for clothing because it moves the collar up/down. Mathematical vertex scaling relative to a specific anchor (Neck Y-Plane) is mandatory.
- **State Management:** When hot-swapping physics geometry, it is safer to destroy and recreate the entire WASM instance rather than trying to update buffers in place. This avoids stale state bugs.

### 4. Next Steps / Plan (Garment Grading & Sizing)

- [ ] **Fit Visualization:** Implement the Strain Heatmap to objectively measure "Tightness."
- [ ] **Fitting Pipeline:** Implement the "Ghost Collider" (growing physics body) to allow XXS shirts to be put on gently.

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
