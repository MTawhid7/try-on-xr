// physics/src/collision/spatial_hash.rs
use glam::Vec3;
use std::collections::HashMap;

/// A sparse grid that maps 3D cells to lists of triangle indices.
pub struct SpatialHash {
    cell_size: f32,
    grid: HashMap<(i32, i32, i32), Vec<usize>>,
}

impl SpatialHash {
    pub fn new(cell_size: f32) -> Self {
        Self {
            cell_size,
            grid: HashMap::new(),
        }
    }

    pub fn clear(&mut self) {
        self.grid.clear();
    }

    fn get_cell(&self, p: Vec3) -> (i32, i32, i32) {
        (
            (p.x / self.cell_size).floor() as i32,
            (p.y / self.cell_size).floor() as i32,
            (p.z / self.cell_size).floor() as i32,
        )
    }

    pub fn insert(&mut self, triangle_idx: usize, min: Vec3, max: Vec3) {
        let (min_x, min_y, min_z) = self.get_cell(min);
        let (max_x, max_y, max_z) = self.get_cell(max);

        for x in min_x..=max_x {
            for y in min_y..=max_y {
                for z in min_z..=max_z {
                    self.grid
                        .entry((x, y, z))
                        .or_insert_with(Vec::new)
                        .push(triangle_idx);
                }
            }
        }
    }

    /// Returns a list of potential triangle indices for a query point.
    /// Includes the cell the point is in, plus neighbors to handle boundary cases.
    pub fn query(&self, p: Vec3, radius: f32) -> Vec<usize> {
        let mut candidates = Vec::new();

        let min = p - Vec3::splat(radius);
        let max = p + Vec3::splat(radius);

        let (min_x, min_y, min_z) = self.get_cell(min);
        let (max_x, max_y, max_z) = self.get_cell(max);

        for x in min_x..=max_x {
            for y in min_y..=max_y {
                for z in min_z..=max_z {
                    if let Some(indices) = self.grid.get(&(x, y, z)) {
                        candidates.extend_from_slice(indices);
                    }
                }
            }
        }

        // Remove duplicates (a triangle might span multiple cells)
        candidates.sort_unstable();
        candidates.dedup();
        candidates
    }
}