# 3D Garment Visualization Engine (V5)

![Status](https://img.shields.io/badge/Status-Stable-green)
![Tech](https://img.shields.io/badge/Stack-Rust_WASM_%7C_React_Three_Fiber-orange)
![Physics](https://img.shields.io/badge/Physics-XPBD_%2B_Interleaved_Solver-blue)

A high-performance, real-time Virtual Try-On (VTO) engine designed for the web.

Version 5 represents a complete architectural maturity, utilizing a **Hybrid Compute Model**. The core physics solver is written in **Rust** and compiled to **WebAssembly (WASM)**, communicating with a **React Three Fiber** frontend via **Zero-Copy** memory synchronization.

---

## 🎯 Project Objective

To create a browser-based cloth simulation that balances **physical realism** with **real-time performance (60 FPS)**. The system is designed to simulate heavy fabrics (cotton, denim) on articulated characters without the jitter, tunneling, or "floating" artifacts common in web-based physics.

---

## 🏗️ Architecture

The project follows a **Domain-Driven, Hexagonal Architecture** to ensure modularity and scalability.

### 1. The Core (Rust + WASM)

* **XPBD Solver:** Extended Position Based Dynamics with sub-stepping (5x) and internal constraint iterations (15x) for high stiffness stability.
* **Interleaved Collision Resolver:** Unlike traditional engines that resolve collision *after* constraints (causing jitter), V5 resolves collision *inside* the constraint loop. This forces the cloth to satisfy both stiffness and contact constraints simultaneously.
* **Memory Model:** **Zero-Copy**. The vertex positions exist in linear WASM memory; JavaScript reads them directly via a `Float32Array` view, eliminating serialization overhead.

### 2. The Frontend (React + TypeScript)

* **Rendering:** React Three Fiber (R3F) renders the visual mesh.
* **State Management:** `Zustand` handles the simulation loop and transient updates outside the React render cycle.
* **Asset Pipeline:** Modular services (`asset_loader/`) handle loading, inspection, normalization, and optimization of raw GLB assets before they reach the physics engine.

### 3. Adaptive Collider Pipeline

* **Smart Decimation:** The engine analyzes the input geometry complexity.
  * **High-Poly Scans (>10k tris):** Automatically decimated to ~5,000 triangles using `meshoptimizer` (WASM) to maintain 60 FPS.
  * **Efficient Models (<5k tris):** Passed through as **Raw Geometry**. This preserves the exact volume and topology of the visual mesh, eliminating the "Invisible Gap" caused by decimation shrinkage.
* **Configurable Smoothing:** Laplacian smoothing is applied dynamically. It is disabled for raw passthrough meshes to ensure the physics collider matches the visual mesh vertex-for-vertex.
* **Pose Normalization:** Raw meshes are statistically analyzed to correct global tilt (Pitch/Roll) and enforce an upright orientation.

---

## 🧬 Engineering Evolution: The "Defense in Depth" Strategy

To solve the "Tunneling vs. Jitter" trade-off, we implemented a multi-layered physics architecture:

1. **Prevention (The Airbag):** **Anisotropic Velocity Clamping**. We limit particle velocity relative to the collision normal. Fast movement is allowed *parallel* to the body, but movement *into* the body is clamped to a safe limit.
2. **Resolution (The Contact):** **Smoothed Mesh Proxy**. We calculate **Barycentric Interpolated Normals** at the point of impact. This approximates a perfectly smooth curved surface, eliminating "ratcheting" artifacts.
3. **Optimization (The Cache):** **Static Spatial Partitioning & Broad Phase Caching**.
    * **Static Hash:** The body collider is hashed once into a dense grid, eliminating 65% of per-frame CPU overhead.
    * **Broad Phase Caching:** Potential collisions are found once per frame (Substep 0) and cached. Substeps 1-4 only perform cheap distance checks against the cache.

---

## 🚀 Key Features

* **Voting-Based Orientation:** A robust 3-factor analysis (Nose, Chest, Toes) determines the true forward direction of arbitrary avatars, solving the "Backward Mannequin" issue.
* **Anatomical Anchoring:** Automatically aligns the shirt collar to the body's neck, ignoring belly protrusion or asymmetric stances.
* **Procedural Grading:** Automatic scaling of the garment geometry to support standard sizes (XXS to XXL).
* **Advanced Aerodynamics:** Triangle-based Lift and Drag forces simulate air resistance. Lift is tuned to near-zero to prevent "flapping" in static poses.
* **Coulomb Friction:** A physically based friction model distinguishes between **Static Friction** (sticking) and **Kinetic Friction** (sliding).
* **Material Zones:** Automatic detection of boundary edges (collars, hems, cuffs) rendered with **0.0 compliance (Rigid)**.
* **Zero-Jitter Resting:** The combination of XPBD and Interleaved Solving allows the cloth to come to a complete rest.

---

## ⚠️ Known Limitations

* **Sleeve Alignment:** If the user's arm pose differs significantly from the garment's modeled pose (e.g., A-Pose vs T-Pose), the arm may clip through the sleeve during initialization.
* **Minor Penetration:** In areas of extreme curvature (e.g., underarms), minor clipping may occur due to the discrete nature of the collision detection.

---

## 🛠️ Setup & Run

### Prerequisites

* Node.js (v18+)
* Rust & Cargo
* `wasm-pack` (`cargo install wasm-pack`)

### Installation

1. **Install JS Dependencies:**

    ```bash
    npm install
    ```

2. **Build WASM Core:**

    ```bash
    npm run build:wasm
    # or
    cd physics && wasm-pack build --target web --out-dir ../src/physics-pkg && cd ..
    ```

3. **Run Development Server:**

    ```bash
    npm run dev
    ```
