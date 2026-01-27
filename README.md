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

---

## 🚀 Key Features

* **Procedural Fabric Shaders:**
  * **Dynamic Normal Maps:** Generates seamless "Cotton Weave" textures in-memory using HTML5 Canvas, eliminating the need for external texture assets.
  * **Matte Finish:** Tuned PBR materials (High Roughness, Low Specular) simulate the dry, light-scattering properties of real cotton.
* **Voting-Based Orientation:** A robust 3-factor analysis (Nose, Chest, Toes) determines the true forward direction of arbitrary avatars.
* **Anatomical Anchoring:** Automatically aligns the shirt collar to the body's neck, ignoring belly protrusion or asymmetric stances.
* **Procedural Grading:** Automatic scaling of the garment geometry to support standard sizes (XXS to XXL).
* **Advanced Aerodynamics:** Triangle-based Lift and Drag forces simulate air resistance.
* **Coulomb Friction:** A physically based friction model distinguishes between **Static Friction** (sticking) and **Kinetic Friction** (sliding).
* **Material Zones:** Automatic detection of boundary edges (collars, hems, cuffs) rendered with **0.0 compliance (Rigid)**.
* **Zero-Jitter Resting:** The combination of XPBD and Interleaved Solving allows the cloth to come to a complete rest.

---

## ⚠️ Known Limitations

* **Oversized Draping:** Large garments (XL/XXL) currently exhibit excessive stiffness ("Tin Can Effect"), failing to collapse naturally under gravity.
* **High-Velocity Penetration:** Rapidly pulling the cloth can cause it to clip through the body mesh due to the thin collision boundary (5mm).
* **Sleeve Alignment:** A-Pose vs T-Pose mismatches can cause initial intersection artifacts.

---

## 🔮 Future Roadmap

1. **Real-World Measurement System:**
   * Move away from generic "S/M/L" scaling.
   * Implement a data-driven pipeline that scales the body and garment based on real-world inputs (Height in cm, Chest in cm).
2. **Ghost Collider (Inflation):** Implement a "Growth" phase where the body collider starts small (fitting inside the shirt) and expands to full size, naturally resolving sleeve clipping issues.
3. **WebGPU Compute Shaders:** Port the `solver.rs` logic to WGSL to support high-density meshes (>10,000 vertices).

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
