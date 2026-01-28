# Vestra Physics Engine

![Version](https://img.shields.io/badge/Version-0.5.0_(Beta)-blue)
![Status](https://img.shields.io/badge/Status-Stable-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)
![Stack](https://img.shields.io/badge/Tech-Rust_%7C_WASM_%7C_React_Three_Fiber-orange)

**Vestra** is a high-performance, real-time Virtual Try-On (VTO) engine built for the modern web.

It utilizes a **Hybrid Compute Architecture** to bridge the gap between physical realism and browser performance. The core physics solver is written in **Rust**, compiled to **WebAssembly (WASM)**, and communicates with a **React Three Fiber** frontend via a **Zero-Copy** memory model.

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

- Contains **Use Cases** (e.g., `InitializeSimulation`) and **Pipelines**.
- **Asset Pipeline:** Orchestrates the loading, analysis, alignment, scaling, and proxy generation of 3D assets.
- **Grading Pipeline:** Handles the mathematical resizing of garments based on real-world sizing charts.

### 3. The Infrastructure (Implementation Layer)

Located in `src/infrastructure`.

- **Physics Adapter:** The bridge to the Rust/WASM backend.
- **Geometry Engine:** Wrappers around `three.js` and `meshoptimizer` for heavy mesh processing.
- **Loaders:** GLTF/GLB handling.

### 4. The Presentation (View Layer)

Located in `src/presentation`.

- **React Components:** UI overlays and controls.
- **Canvas:** React Three Fiber (R3F) scene graph.
- **State:** `Zustand` stores for managing the simulation loop and UI state.

### 5. The Physics Backend (Rust)

Located in `physics/`.

- **Data-Oriented Design:** State is stored in flat vectors (SoA) for cache efficiency.
- **XPBD Solver:** Extended Position Based Dynamics with sub-stepping (8x) and internal constraint iterations (25x).
- **Interleaved Solver:** Collision resolution occurs *inside* the constraint loop to eliminate jitter.

---

## 🚀 Key Features

### 🧶 Physics & Simulation

- **XPBD Solver:** Stable simulation of stiff constraints (non-stretchy fabrics) using compliance-based solving.
- **Anisotropic Bending:** Distinguishes between "warp/weft" (stiff) and "bias" (stretchy) directions based on UV coordinates.
- **Coulomb Friction:** Physically based friction model distinguishing between static (sticking) and kinetic (sliding) friction.
- **Aerodynamics:** Real-time lift and drag forces based on relative velocity and wind vectors.

### 📐 Asset Intelligence

- **Smart Decimation:** Automatically analyzes mesh complexity. High-poly meshes (>10k tris) are decimated via `meshoptimizer` for physics proxies, while efficient meshes are used raw to preserve volume.
- **Anatomical Anchoring:** Automatically detects the neck position of the avatar and snaps the garment collar to fit.
- **Voting-Based Orientation:** A heuristic algorithm analyzes mesh topology (Nose, Chest, Toes) to automatically correct upside-down or backward avatars.

### 📏 Real-World Grading

- **Body Measurer:** Algorithms slice the mannequin geometry to calculate exact chest circumference in centimeters.
- **Standard Sizing:** Garments are graded (scaled) based on retail standards (XS - XXL).
- **Mass-Normalized Compliance:** Physics stiffness scales dynamically with garment size to prevent larger garments from behaving like "tin cans."

---

## 📂 Project Structure

```text
root/
├── physics/                    # Rust Source Code
│   ├── src/
│   │   ├── engine/             # State & Config
│   │   ├── systems/            # Forces, Constraints, Dynamics
│   │   ├── collision/          # Spatial Hashing & Resolvers
│   │   └── lib.rs              # WASM Interface
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
    This compiles the Rust code to WebAssembly and generates the JS bindings in `src/physics-pkg`.

    ```bash
    cd physics && wasm-pack build --target web --out-dir ../src/physics-pkg && cd ..
    ```

4. **Run the Development Server:**

    ```bash
    npm run dev
    ```

    Open `http://localhost:5173` in your browser.

---

## ⚙️ Configuration and Tuning

Vestra is designed to be tunable.

### Physics Parameters

Modify `physics/src/engine/config.rs` to tune the simulation behavior.

- `substeps`: Higher = more accurate, more CPU usage.
- `solver_iterations`: Higher = stiffer cloth.
- `contact_thickness`: The padding distance for collisions.
- `drag_coeff`: Air resistance.

### Asset Pipeline

Modify `src/core/constants/SimulationConstants.ts` to tune the asset processing.

- `TARGET_BODY_HEIGHT`: The normalized height for avatars (default: 1.75m).
- `GARMENT_RESOLUTION_BUDGET`: Max triangle count for cloth physics.
- `GEOMETRY_WELD_THRESHOLD`: Distance to merge vertices (fixes detached collars).

---

## 🛠 Development Workflow

The project uses a hybrid workflow.

1. **Frontend Changes:**
    - Modify files in `src/`.
    - Vite HMR (Hot Module Replacement) updates the browser instantly.

2. **Physics Changes:**
    - Modify files in `physics/src/`.
    - Run `wasm-pack build ...` (or create a script in package.json).
    - Vite will detect the change in `src/physics-pkg` and reload the page.

---

## 🔮 Roadmap

- [ ] **Self-Collision:** Re-enable the spatial hashing self-collision system (currently implemented but disabled for performance).
- [ ] **User Input:** UI for users to input custom height/weight measurements to morph the mannequin.
- [ ] **WebGPU:** Explore porting the solver logic to WGSL Compute Shaders for massive particle counts (>50k).
- [ ] **Multi-Layering:** Support for tucking shirts into pants or layering jackets.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
