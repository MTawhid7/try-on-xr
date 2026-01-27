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

* **XPBD Solver:** Extended Position Based Dynamics with sub-stepping (8x) and internal constraint iterations (25x) for high stiffness stability.
* **Interleaved Collision Resolver:** Unlike traditional engines that resolve collision *after* constraints (causing jitter), V5 resolves collision *inside* the constraint loop.
* **Memory Model:** **Zero-Copy**. The vertex positions exist in linear WASM memory; JavaScript reads them directly via a `Float32Array` view.

### 2. The Frontend (React + TypeScript)

* **Rendering:** React Three Fiber (R3F) renders the visual mesh.
* **State Management:** `Zustand` handles the simulation loop and transient updates.
* **Asset Pipeline:** Modular services (`asset_loader/`) handle loading, inspection, normalization, and optimization.

### 3. Adaptive Asset Pipeline (Body & Garment)

* **Smart Decimation:** The engine analyzes the input geometry complexity for *both* the body and the garment.
  * **High-Poly (>10k tris):** Automatically decimated using `meshoptimizer` (WASM) to maintain 60 FPS.
  * **Efficient Models (<5k tris):** Passed through as **Raw Geometry**. This preserves the exact volume and topology, eliminating the "Invisible Gap" caused by decimation shrinkage.
* **Goldilocks Tuning:**
  * **Inflation:** A 2mm (`0.002`) invisible buffer is applied to the collider to prevent clipping without creating a "Space Suit" effect.
  * **Substeps:** Increased to 8x to catch high-velocity collisions.

---

## 🚀 Key Features

* **Real-World Measurement System:**
  * **Body Measurer:** Automatically slices the mannequin geometry to calculate the exact Chest Circumference in cm.
  * **Standard Sizing:** Garments are graded based on real-world dimensions (e.g., Size M = 51cm Width) rather than arbitrary scales.
  * **Mass-Normalized Compliance:** Physics stiffness scales dynamically with garment size, preventing the "Tin Can" effect on XXL garments.
* **Procedural Fabric Shaders:**
  * **Dynamic Normal Maps:** Generates seamless "Cotton Weave" textures in-memory.
  * **Matte Finish:** Tuned PBR materials simulate the dry, light-scattering properties of cotton.
* **Voting-Based Orientation:** A robust 3-factor analysis (Nose, Chest, Toes) determines the true forward direction of arbitrary avatars.
* **Anatomical Anchoring:** Automatically aligns the shirt collar to the body's neck.
* **Coulomb Friction:** A physically based friction model distinguishes between **Static Friction** (sticking) and **Kinetic Friction** (sliding).* **Material Zones:** Automatic detection of boundary edges (collars, hems, cuffs) rendered with **0.0 compliance (Rigid)**.
* **Zero-Jitter Resting:** The combination of XPBD and Interleaved Solving allows the cloth to come to a complete rest.

---

## ⚠️ Known Limitations

* **Sleeve Alignment:** A-Pose vs T-Pose mismatches can cause initial intersection artifacts.
* **Complex Layering:** Currently supports single-layer garments only.

---

## 🔮 Future Roadmap

1. **User Measurement Input:**
   * Allow users to input Height/Weight/Chest.
   * Procedurally morph the mannequin to match these inputs.
2. **Garment Orientation Analysis:**
   * Implement "Hole Detection" to automatically orient shirts that are imported upside-down.
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
