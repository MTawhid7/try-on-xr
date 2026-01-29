# Vestra Physics Engine

![Version](https://img.shields.io/badge/Version-0.6.0_(Performance)-blue)
![Status](https://img.shields.io/badge/Status-Stable-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![Stack](https://img.shields.io/badge/Tech-Rust_%7C_WASM_%7C_SIMD_%7C_React_Three_Fiber-orange)

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

- Defines the **Entities** (Garment, Assets) and **Interfaces** (Contracts).
- Pure TypeScript. No dependencies on React, Three.js, or WASM.
- Contains the "Business Logic" of sizing standards and simulation constants.

### 2. The Application (Orchestration Layer)

Located in `src/application`.

- **Asset Pipeline:** Orchestrates loading, analysis, alignment, scaling, and proxy generation. Features **Smart Welding** to close UV seams and **Adaptive Clustering** for accurate body measurement.
- **Grading Pipeline:** Handles the mathematical resizing of garments based on real-world sizing charts.

### 3. The Infrastructure (Implementation Layer)

Located in `src/infrastructure`.

- **Physics Adapter:** The bridge to the Rust/WASM backend. Implements **Zero-Copy** rendering using `THREE.InterleavedBufferAttribute` to bind WASM memory directly to the GPU.
- **Geometry Engine:** Wrappers around `three.js` and `meshoptimizer`.

### 4. The Presentation (View Layer)

Located in `src/presentation`.

- **React Components:** UI overlays and controls.
- **Canvas:** React Three Fiber (R3F) scene graph.
- **State:** `Zustand` stores for managing the simulation loop and UI state.

### 5. The Physics Backend (Rust)

Located in `physics/`.

- **Data-Oriented Design:** State is stored in **16-byte aligned** `Vec4` arrays (SoA) for SIMD efficiency.
- **XPBD Solver:** Extended Position Based Dynamics with **Chebyshev Acceleration** and **Speculative Contacts**.
- **Memory Management:** Uses pre-allocated buffers and CSR (Compressed Sparse Row) adjacency lists to ensure **Zero-Allocation** during the simulation loop.

---

## 🚀 Key Features

### 🧶 Physics & Simulation

- **XPBD Solver:** Stable simulation of stiff constraints (non-stretchy fabrics) using compliance-based solving.
- **Anisotropic Bending:** Distinguishes between "warp/weft" (stiff) and "bias" (stretchy) directions based on UV coordinates.
- **Coulomb Friction:** Physically based friction model distinguishing between static (sticking) and kinetic (sliding) friction.
- **Aerodynamics:** Real-time lift and drag forces based on relative velocity and wind vectors.
- **SIMD Vectorization:** Core constraints are rewritten to use 128-bit vector instructions, processing 4 floating-point operations per cycle.
- **Chebyshev Acceleration:** Uses a dynamic relaxation factor ($\omega$) to converge to a stiff solution in fewer iterations (15 vs 25), boosting FPS by ~40%.
- **Speculative Contacts:** Predicts collisions before they happen to prevent "tunneling" (clipping) during fast motion.
- **Area Conservation:** Resists shearing to prevent the "chainmail" effect, simulating continuous fabric surfaces.
- **Hybrid Solver:** Combines accelerated internal constraints with damped collision resolution for maximum stability.

### 📐 Asset Intelligence

- **Smart Welding:** Automatically merges vertices at UV seams (up to 1.5cm) while respecting normal direction to prevent merging front/back panels.
- **Adaptive Body Measurement:** Uses cluster analysis to mathematically isolate the torso from the arms, ensuring accurate chest measurements even in A-Pose.
- **Anatomical Anchoring:** Automatically detects the neck position and snaps the garment collar to fit.
- **Voting-Based Orientation:** A heuristic algorithm analyzes mesh topology (Nose, Chest, Toes) to automatically correct upside-down or backward avatars.

### ⚡ Performance

- **Zero-Copy Rendering:** The Three.js geometry reads vertex positions directly from WASM memory. No data copying occurs between CPU and GPU.
- **Zero-Allocation Loop:** The physics step generates zero garbage, eliminating micro-stutters caused by the Garbage Collector.
- **Static Spatial Hashing:** Optimized broad-phase collision detection for static bodies.

---

## 📂 Project Structure

```text
root/
├── physics/                    # Rust Source Code
│   ├── src/
│   │   ├── engine/             # State, Config, Simulation Loop
│   │   ├── systems/            # Constraints (Distance, Area, Bending), Forces
│   │   ├── collision/          # Spatial Hashing, Resolvers, Geometry
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

    Open `http://localhost:5173` in your browser.

---

## ⚙️ Configuration and Tuning

Vestra is designed to be tunable. Modify `physics/src/engine/config.rs` to adjust behavior.

- `substeps`: (Default: 8) Higher = more accurate, more CPU usage.
- `solver_iterations`: (Default: 15) Lowered thanks to Chebyshev acceleration.
- `spectral_radius`: (Default: 0.85) Controls the aggressiveness of Chebyshev acceleration. Lower if cloth jitters.
- `area_compliance`: (Default: 2.0e-4) Controls shear resistance. Lower = Stiffer (Sheet metal), Higher = Stretchy (Spandex).
- `damping`: (Default: 0.99) Global energy loss per frame.

---

## 🛠 Development Workflow

The project uses a hybrid workflow.

1. **Frontend Changes:**
    - Modify files in `src/`.
    - Vite HMR (Hot Module Replacement) updates the browser instantly.

2. **Physics Changes:**
    - Modify files in `physics/src/`.
    - Run the `wasm-pack` build command.
    - Vite will detect the change in `src/physics-pkg` and reload the page.

---

## 🔮 Roadmap

- [ ] **Self-Collision:** Implement a Linear BVH (LBVH) to handle cloth-on-cloth collisions efficiently.
- [ ] **User Input:** UI for users to input custom height/weight measurements to morph the mannequin.
- [ ] **WebGPU:** Explore porting the solver logic to WGSL Compute Shaders for massive particle counts (>50k).
- [ ] **Multi-Layering:** Support for tucking shirts into pants or layering jackets.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
