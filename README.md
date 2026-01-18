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

* **XPBD Solver:** Extended Position Based Dynamics with sub-stepping (10x) and internal constraint iterations (10x) for high stiffness stability.
* **Interleaved Collision Resolver:** Unlike traditional engines that resolve collision *after* constraints (causing jitter), V5 resolves collision *inside* the constraint loop. This forces the cloth to satisfy both stiffness and contact constraints simultaneously.
* **Memory Model:** **Zero-Copy**. The vertex positions exist in linear WASM memory; JavaScript reads them directly via a `Float32Array` view, eliminating serialization overhead.

### 2. The Frontend (React + TypeScript)

* **Rendering:** React Three Fiber (R3F) renders the visual mesh.
* **State Management:** `Zustand` handles the simulation loop and transient updates outside the React render cycle.
* **Asset Pipeline:** Custom loaders process GLB files, welding vertices to repair topology and extracting normal data for the physics engine.

---

## 🧬 Engineering Evolution: The "Defense in Depth" Strategy

To solve the "Tunneling vs. Jitter" trade-off, we implemented a multi-layered physics architecture:

1. **Prevention (The Airbag):** **Anisotropic Velocity Clamping**. We limit particle velocity relative to the collision normal. Fast movement is allowed *parallel* to the body, but movement *into* the body is clamped to a safe limit, making tunneling mathematically impossible for 90% of cases.
2. **Resolution (The Contact):** **Smoothed Mesh Proxy**. We calculate **Barycentric Interpolated Normals** at the point of impact. This approximates a perfectly smooth curved surface, eliminating "ratcheting" artifacts.
3. **Optimization (The Cache):** **Cached Contact Constraints**. Instead of running expensive spatial queries inside the solver loop, we find active contacts once per substep and cache them. This allows us to run the solver math 100x per frame without CPU overhead.

---

## 🚀 Key Features

* **Advanced Aerodynamics:** Triangle-based Lift and Drag forces simulate air resistance relative to the surface angle, creating realistic flutter and sway during movement.
* **Coulomb Friction:** A physically based friction model distinguishes between **Static Friction** (sticking) and **Kinetic Friction** (sliding), allowing garments to grip the body naturally without artificial constraints.
* **Asymmetric Proxy Bias:** A "Virtual Foam" layer (Soft Offset) dampens geometric noise from the low-poly collider, preventing lateral drift and creating a stable, heavy drape.
* **Material Zones:** Automatic detection of boundary edges (collars, hems, cuffs). These are rendered with **0.0 compliance (Rigid)**, while the body remains flexible, simulating reinforced seams.
* **Zero-Jitter Resting:** The combination of XPBD and Interleaved Solving allows the cloth to come to a complete rest without micro-vibrations.
* **Interactive Physics:** Users can grab and pull the fabric. The solver prioritizes user interaction (with camera controls disabled during interaction), allowing for tactile testing of material properties.
* **Anisotropic Bending:** The material resists bending differently along the UV axes (Warp/Weft) versus the diagonal (Bias), creating realistic draping folds.
* **Self-Collision:** A dedicated Spatial Hash Grid prevents the cloth from passing through itself, enabling realistic folding and multi-layer interactions.

---

## ⚠️ Known Limitations

* **Fitting Pipeline:** The shirt currently spawns in its final position. If the garment is significantly smaller than the body, it may explode or stretch violently on the first frame. A "Growth" or "Sewing" phase is required for tight-fitting garments.
* **Extreme Force Detachment:** If the cloth is pulled with excessive force (beyond realistic human strength), it may clip through the collision body. This is an intentional trade-off to maintain performance; we prioritize stability under normal conditions over absolute impermeability under extreme stress.

---

## 🔮 Future Roadmap

1. **Fitting Pipeline:** Re-introduce the "Hulk" growth strategy (animating body scale from 0.8 to 1.0) to allow tight garments to settle naturally without initial intersection.
2. **Visual Fidelity:** Implement a custom shader for **Anisotropic Lighting** to simulate the weave of the fabric and Normal Mapping for high-frequency wrinkles.
3. **WebGPU Compute Shaders:** Port the `solver.rs` logic to WGSL. This will unlock the ability to simulate high-density meshes (>10,000 vertices) by parallelizing constraint solving.

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
