// physics/src/collision/spatial/dynamic.rs

use glam::Vec3;
use std::collections::HashMap;

pub struct DynamicSpatialHash {
    cell_size: f32,
    grid: HashMap<(i32, i32, i32), Vec<usize>>,
}

impl DynamicSpatialHash {
    pub fn new(cell_size: f32) -> Self {
        Self {
            cell_size,
            grid: HashMap::new(),
        }
    }

    pub fn clear(&mut self) {
        for (_, list) in self.grid.iter_mut() {
            list.clear();
        }
    }

    fn get_cell(&self, p: Vec3) -> (i32, i32, i32) {
        (
            (p.x / self.cell_size).floor() as i32,
            (p.y / self.cell_size).floor() as i32,
            (p.z / self.cell_size).floor() as i32,
        )
    }

    pub fn insert_point(&mut self, id: usize, p: Vec3) {
        let cell = self.get_cell(p);
        self.grid
            .entry(cell)
            .or_insert_with(Vec::new)
            .push(id);
    }

    pub fn query(&self, p: Vec3, radius: f32, buffer: &mut Vec<usize>) {
        buffer.clear();
        let min = p - Vec3::splat(radius);
        let max = p + Vec3::splat(radius);

        let (min_x, min_y, min_z) = self.get_cell(min);
        let (max_x, max_y, max_z) = self.get_cell(max);

        for x in min_x..=max_x {
            for y in min_y..=max_y {
                for z in min_z..=max_z {
                    if let Some(indices) = self.grid.get(&(x, y, z)) {
                        buffer.extend_from_slice(indices);
                    }
                }
            }
        }
        buffer.sort_unstable();
        buffer.dedup();
    }
}