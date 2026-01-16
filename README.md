# 3D Garment Visualization Engine (V5)

![Status](https://img.shields.io/badge/Status-Stable-green)
![Tech](https://img.shields.io/badge/Stack-Rust_WASM_%7C_React_Three_Fiber-orange)
![Physics](https://img.shields.io/badge/Physics-XPBD_%2B_Smoothed_Proxy-blue)

A high-performance, real-time Virtual Try-On (VTO) engine designed for the web.

Version 5 represents a complete architectural maturity, utilizing a **Hybrid Compute Model**. The core physics solver is written in **Rust** and compiled to **WebAssembly (WASM)**, communicating with a **React Three Fiber** frontend via **Zero-Copy** memory synchronization.

---

## 🎯 Project Objective

To create a browser-based cloth simulation that balances **physical realism** with **real-time performance (60 FPS)**. The system is designed to simulate heavy fabrics (cotton, denim) on articulated characters without the jitter, tunneling, or "floating" artifacts common in web-based physics.

---

## 🏗️ Architecture

The project follows a **Domain-Driven, Hexagonal Architecture** to ensure modularity and future scalability (e.g., swapping the solver for WebGPU).

### 1. The Core (Rust + WASM)

* **XPBD Solver:** Extended Position Based Dynamics with sub-stepping (10x) and internal constraint iterations (10x) for high stiffness stability.
* **Collision System:** A custom **Spatial Hash Grid** combined with a **Smoothed Mesh Proxy**.
* **Memory Model:** **Zero-Copy**. The vertex positions exist in linear WASM memory; JavaScript reads them directly via a `Float32Array` view, eliminating serialization overhead.

### 2. The Frontend (React + TypeScript)

* **Rendering:** React Three Fiber (R3F) renders the visual mesh.
* **State Management:** `Zustand` handles the simulation loop and transient updates outside the React render cycle.
* **Asset Pipeline:** Custom loaders process GLB files, welding vertices to repair topology and extracting normal data for the physics engine.

---

## 🧬 Engineering Evolution & Challenges

This project has evolved through several iterations to solve the "Real-Time Cloth" problem.

### ❌ V4: The SDF Experiment (Deprecated)

In the previous version, we attempted to use **Signed Distance Fields (SDF)** for collision.

* **The Approach:** Voxelize the body into a 3D grid and push particles out based on gradient.
* **The Failure:**
  * **Ratcheting:** Voxel aliasing created "steps" on the body surface. Cloth would get stuck on these steps, causing it to climb up the neck (the "Life Preserver" effect).
  * **Tunneling:** Thin geometry (arms) was thinner than the voxel size, causing cloth to pass through.
  * **Performance:** Baking a 128³ SDF took ~30 seconds on the CPU.

### ✅ V5: Smoothed Mesh Proxy (Current)

We pivoted to the industry-standard approach used in high-end games (e.g., *The Last of Us*).

* **The Approach:** Use a low-poly proxy mesh (~2,500 tris) for the body.
* **The Innovation:** instead of colliding with flat triangles, we calculate **Barycentric Interpolated Normals** at the point of impact.
* **The Result:** The physics engine "sees" a perfectly smooth, curved surface. Friction is consistent, "ratcheting" is eliminated, and setup time is instant.

---

## 🚀 Key Features

* **Material Zones:** Automatic detection of boundary edges (collars, hems, cuffs). These are rendered with **0.0 compliance (Rigid)**, while the body remains flexible, simulating reinforced seams.
* **Zero-Jitter Resting:** The combination of XPBD and smoothed collisions allows the cloth to come to a complete rest without micro-vibrations.
* **Interactive Physics:** Users can grab and pull the fabric. The solver prioritizes user interaction (with camera controls disabled during interaction), allowing for tactile testing of material properties.
* **Robust Collision:** "Inside/Outside" logic detects if a particle spawns inside the body and aggressively projects it out, preventing initial entanglements.
* **Self-Collision:** A dedicated Spatial Hash Grid prevents the cloth from passing through itself, enabling realistic folding and multi-layer interactions.

---

## ⚠️ Known Limitations

* **Lateral Bias:** In some resting states, the shirt may exhibit a slight lateral drift due to asymmetric triangulation in the low-poly proxy.
* **Extreme Force Detachment:** If the cloth is pulled with excessive force (beyond realistic human strength), it may clip through the collision body. This is an intentional trade-off to maintain performance; we prioritize stability under normal conditions over absolute impermeability under extreme stress.

---

## 🔮 Future Roadmap

1. **WebGPU Compute Shaders:** Port the `solver.rs` logic to WGSL. This will unlock the ability to simulate high-density meshes (>10,000 vertices) by parallelizing constraint solving.
2. **Fitting Pipeline:** Re-introduce the "Hulk" growth strategy (animating body scale from 0.8 to 1.0) to allow tight garments to settle naturally without initial intersection.

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
    ```

3. **Run Development Server:**

    ```bash
    npm run dev
    ```
