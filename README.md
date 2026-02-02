# Vestra Physics Engine

![Version](https://img.shields.io/badge/Version-0.9.0_(SIMD_&_Parallelism)-blue)
![Status](https://img.shields.io/badge/Status-Stable-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![Stack](https://img.shields.io/badge/Tech-Rust_%7C_WASM_%7C_SIMD128_%7C_React_Three_Fiber-orange)

**Vestra** is a high-performance, real-time Virtual Try-On (VTO) engine built for the modern web.

It utilizes a **Hybrid Compute Architecture** to bridge the gap between physical realism and browser performance. The core physics solver is written in **Rust**, compiled to **WebAssembly (WASM)** with **SIMD128** acceleration, and communicates with a **React Three Fiber** frontend via a **Zero-Copy** memory model.

Unlike traditional JavaScript-based physics engines, Vestra is designed specifically for cloth simulation, handling heavy fabrics (cotton, denim) on articulated characters without the jitter, tunneling, or "floating" artifacts common in web-based solutions.

---

## 📚 Table of Contents

- [Architecture](#-architecture)
- [Key Features](#-key-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Configuration and Tuning](#%EF%B8%8F-configuration-and-tuning)
- [Development Workflow](#-development-workflow)
- [Roadmap](#-roadmap)

---

## 🏗 Architecture

Vestra follows **Clean Architecture (Hexagonal Architecture)** principles to ensure separation of concerns, testability, and scalability.

### 1. The Core (Domain Layer)

Located in `src/core`.

- **Entities:** Pure data structures (`Garment`, `SimulationState`) that embody the business rules.
- **Interfaces:** Contracts for external dependencies (e.g., `ISimulationEngine`).
- **Logic:** Universal constants and sizing standards. Zero dependencies on React or Three.js.

### 2. The Application (Use Cases Layer)

Located in `src/application`.

- **Pipelines:** Complex, multi-step workflows like `AssetPreparationPipeline` and `GradingPipeline`.
- **Orchestration:** Coordinates the flow of data between the UI, the Physics Engine, and the Renderer.
- **DTOs:** Data Transfer Objects for passing state between layers.

### 3. The Infrastructure (Adapter Layer)

Located in `src/infrastructure`.

- **WASM Adapter:** The bridge to the Rust backend. Handles memory marshalling and Zero-Copy buffer synchronization.
- **Geometry Engine:** Implementation of complex algorithms like `MeshAnalyzer` (Slicing) and `ProxyGenerator` (Decimation).
- **Rendering:** `TextureGenerator` strategies and Three.js setups.

### 4. The Presentation (UI Layer)

Located in `src/presentation`.

- **React Components:** Pure UI overlays (Status Panels, Controls).
- **Zustand Stores:** State management for the simulation loop (`simulationStore`).
- **Canvas:** The React Three Fiber scene graph.

### 5. The Physics Backend (Rust)

Located in `physics/`.

- **Data-Oriented Design:** State is stored in **16-byte aligned** `Vec4` arrays (SoA) for SIMD efficiency.
- **XPBD Solver:** Extended Position Based Dynamics with **Chebyshev Acceleration** and **Speculative Contacts**.
- **Memory Management:** Uses pre-allocated buffers and CSR (Compressed Sparse Row) adjacency lists to ensure **Zero-Allocation** during the simulation loop.

---

## 🚀 Key Features

### 🧶 Physics & Simulation

- **XPBD Solver:** Stable simulation of stiff constraints (non-stretchy fabrics) using compliance-based solving.
- **Optimized Parallel Self-Collision:** A high-performance collision system that prevents the cloth from passing through itself.
  - **Three-Phase Resolution:** Detects potential pairs via spatial hash, colors the collision graph for safety, and resolves batches in parallel.
  - **SIMD Batching:** Utilizes 128-bit vector registers to resolve 4 collision pairs simultaneously.
  - **Hierarchical Spatial Hash:** Uses Morton codes and a multi-level grid for cache-coherent O(1) lookups.
  - **Topology-Aware Exclusion:** Precomputed bitmasks filter out connected vertices in O(1) time, preventing self-explosion.
  - **Reduced frequency solving:** Configurable update frequency (e.g., every 2nd substep) to maintain high FPS.
- **Anisotropic Bending:** Distinguishes between "warp/weft" (stiff) and "bias" (stretchy) directions based on UV coordinates for realistic fabric buckling.
- **Coulomb Friction:** Physically based friction model distinguishing between static (sticking) and kinetic (sliding) friction.
- **Aerodynamics:** Real-time lift and drag forces based on relative velocity and wind vectors.
- **SIMD Vectorization:** Core constraints (Distance, Bending, Tether) and integrator patterns are implemented with manual WASM SIMD128 intrinsics, processing 4 operations per cycle.
- **Chebyshev Acceleration:** Uses a dynamic relaxation factor ($\omega$) to converge to a stiff solution in fewer iterations, boosting convergence rate significantly.
- **Speculative Contacts:** Predicts collisions before they happen to prevent "tunneling" (clipping) during fast motion.
- **Area Conservation:** Resists shearing to prevent the "chainmail" effect, simulating continuous fabric surfaces.
- **WASM Normal Computation:** Vertex normals are computed in Rust after every physics step, eliminating the O(N) JavaScript bottleneck on the main thread.

### 📐 Asset Intelligence

- **Smart Welding:** Automatically merges vertices at UV seams (up to 1.5cm) while respecting normal direction to prevent merging front/back panels.
- **Adaptive Body Measurement:** Uses cluster analysis to mathematically isolate the torso from the arms, ensuring accurate chest measurements even in A-Pose.
- **Anatomical Anchoring:** Automatically detects the neck position and snaps the garment collar to fit.
- **Voting-Based Orientation:** A robust heuristic algorithm (`OrientationOptimizer`) uses three independent "voters" to determine mesh orientation:
  - **Chest Voter:** Checks for pectoral mass bias (Z-forward).
  - **Feet Voter:** Checks for toe protrusion.
  - **Head Voter:** Checks for face/nose offset.
  - *Result:* Automatically corrects 99% of "Upside Down" or "Backward" avatars without user intervention.
- **Procedural Material Generation:** Uses an in-memory `TextureGenerator` (Canvas API) to create high-frequency "Cotton Weave" normal maps on the fly, eliminating the need for large external texture assets.

### ⚡ Performance

- **Zero-Copy Rendering:** Three.js reads directly from WASM memory. No data copying between CPU and GPU.
- **Zero-Allocation Loop:** No garbage collection spikes during simulation.
- **Static Spatial Hashing:** O(1) broad-phase collision detection for static mannequins.

---

## 📂 Project Structure

```text
root/
├── physics/                    # Rust Source Code
│   ├── src/
│   │   ├── engine/             # State, Config, Simulation Loop
│   │   ├── systems/            # Constraints (Distance, Area, Bending), Forces
│   │   ├── collision/          # Spatial Hashing, Resolvers, Geometry, Exclusion
│   │   └── utils/              # Graph Coloring, CSR Adjacency
│   └── Cargo.toml
│
├── src/                        # TypeScript Frontend
│   ├── core/                   # Domain Entities & Interfaces
│   ├── application/            # Use Cases & Pipelines
│   ├── infrastructure/         # Adapters (WASM, Three.js)
│   ├── presentation/           # React Components & State
│   └── main.tsx                # Entry Point
│
└── public/                     # Static Assets (Models)
```

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **Rust** (Latest Stable)
- **wasm-pack** (`cargo install wasm-pack`)

### Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/MTawhid7/vestra-physics.git
    cd vestra-physics
    ```

2. **Install JavaScript dependencies:**

    ```bash
    npm install
    ```

3. **Compile the Physics Engine:**
    **CRITICAL:** You must use the following flags to enable SIMD and pre-allocate memory.

    ```bash
    cd physics && RUSTFLAGS='-C target-feature=+simd128 -C link-arg=--initial-memory=134217728' wasm-pack build --target web --out-dir ../src/physics-pkg && cd ..
    ```

    *Note: `134217728` allocates 128MB of RAM upfront to prevent resizing stutters.*

4. **Run the Development Server:**

    ```bash
    npm run dev
    ```

---

## ⚙️ Configuration and Tuning

Modify `physics/src/engine/config.rs` to adjust behavior.

- `substeps`: (Default: 6) Higher = more accurate.
- `solver_iterations`: (Default: 12) Controls constraint stiffness.
- `spectral_radius`: (Default: 0.92) Aggressiveness of Chebyshev acceleration.
- `self_collision_enabled`: (Default: true) Master toggle for cloth-on-cloth collision.
- `self_collision_thickness`: (Default: 0.005) Minimum separation between cloth layers.
- `self_collision_frequency`: (Default: 2) Update every N substeps.
- `area_compliance`: (Default: 2.0e-4) Shear resistance.

---

## 🛠 Development Workflow

1. **Frontend Changes:** Vite HMR updates the browser instantly.
2. **Physics Changes:** Run the `wasm-pack` command above; Vite will reload the page automatically.

---

## 🔮 Roadmap

- [x] **Parallel Batch Solving:** Implement graph-colored collision pairs for multi-threaded resolution.
- [ ] **Temporal Coherence:** Incremental spatial hash updates via Morton code tracking.
- [ ] **WebGPU:** Port the solver logic to WGSL Compute Shaders for massive particle counts (>50k).
- [ ] **User Input:** UI for custom anatomical measurements to morph the mannequin.
- [ ] **Multi-Layering:** Support for complex garment layering (e.g., blazer over hoodie).

---

## 📄 License

This project is licensed under the MIT License.
