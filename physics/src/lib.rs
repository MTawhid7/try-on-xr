// physics/src/lib.rs
mod engine;
mod dynamics;
mod constraints;
mod collision;
mod utils;

use wasm_bindgen::prelude::*;
use engine::simulation::SimulationLoop;

#[wasm_bindgen]
pub struct PhysicsEngine {
    sim: SimulationLoop,
}

#[wasm_bindgen]
impl PhysicsEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(
        garment_pos: Vec<f32>,
        garment_indices: Vec<u32>,
        garment_uvs: Vec<f32>, // NEW
        collider_pos: Vec<f32>,
        collider_normals: Vec<f32>,
        collider_indices: Vec<u32>
    ) -> PhysicsEngine {
        utils::set_panic_hook();

        PhysicsEngine {
            sim: SimulationLoop::new(
                garment_pos,
                garment_indices,
                garment_uvs, // Pass
                collider_pos,
                collider_normals,
                collider_indices
            ),
        }
    }

    pub fn step(&mut self, dt: f32) {
        self.sim.step(dt);
    }

    pub fn get_positions_ptr(&self) -> *const f32 {
        self.sim.state.positions[0].as_ref().as_ptr()
    }

    // --- Interaction Methods ---

    pub fn set_interaction(&mut self, index: usize, x: f32, y: f32, z: f32) {
        self.sim.mouse.grab(index, glam::Vec3::new(x, y, z));
    }

    pub fn update_interaction(&mut self, x: f32, y: f32, z: f32) {
        self.sim.mouse.update_target(glam::Vec3::new(x, y, z));
    }

    pub fn end_interaction(&mut self) {
        self.sim.mouse.release();
    }
}