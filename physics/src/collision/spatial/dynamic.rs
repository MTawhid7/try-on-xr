// physics/src/collision/spatial/dynamic.rs

use glam::Vec3;
use std::collections::HashMap;

/// A sparse hash map-based spatial grid.
/// Used for moving objects or scenarios where the bounds are not known ahead of time.
/// Slightly slower than `StaticSpatialHash` but infinite in extent.
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

    /// Inserts a particle index into the spatial entity.
    /// The key is derived from the floor of the position divided by cell size.
    pub fn insert_point(&mut self, id: usize, p: Vec3) {
        let cell = self.get_cell(p);
        self.grid
            .entry(cell)
            .or_insert_with(Vec::new)
            .push(id);
    }

    /// Finds all particles within the given radius of a point.
    /// Queries the cell containing the point and all immediate neighbors (3x3x3 block).
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