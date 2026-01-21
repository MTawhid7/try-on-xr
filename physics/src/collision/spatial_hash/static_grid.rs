// physics/src/collision/spatial_hash/static_grid.rs
use glam::Vec3;

pub struct StaticSpatialHash {
    cell_size: f32,
    min: Vec3,
    // Add max for AABB check
    max: Vec3,
    width: usize,
    height: usize,
    depth: usize,
    cells: Vec<Vec<usize>>,
}

impl StaticSpatialHash {
    pub fn new(bounds_min: Vec3, bounds_max: Vec3, cell_size: f32) -> Self {
        let padding = Vec3::splat(cell_size * 2.0);
        let min = bounds_min - padding;
        let max = bounds_max + padding;

        let size = max - min;

        let width = (size.x / cell_size).ceil() as usize;
        let height = (size.y / cell_size).ceil() as usize;
        let depth = (size.z / cell_size).ceil() as usize;

        let safe_width = width.max(1).min(1000);
        let safe_height = height.max(1).min(1000);
        let safe_depth = depth.max(1).min(1000);

        let total_cells = safe_width * safe_height * safe_depth;

        Self {
            cell_size,
            min,
            max, // Store it
            width: safe_width,
            height: safe_height,
            depth: safe_depth,
            cells: vec![Vec::new(); total_cells],
        }
    }

    // New helper for AABB Pruning
    pub fn contains(&self, p: Vec3) -> bool {
        p.x >= self.min.x && p.x <= self.max.x &&
        p.y >= self.min.y && p.y <= self.max.y &&
        p.z >= self.min.z && p.z <= self.max.z
    }

    pub fn insert_aabb(&mut self, id: usize, min: Vec3, max: Vec3) {
        // ... (Existing implementation) ...
        let start_local = (min - self.min).max(Vec3::ZERO);
        let end_local = max - self.min;

        let min_x = (start_local.x / self.cell_size) as usize;
        let min_y = (start_local.y / self.cell_size) as usize;
        let min_z = (start_local.z / self.cell_size) as usize;

        let max_x = ((end_local.x / self.cell_size) as usize).min(self.width - 1);
        let max_y = ((end_local.y / self.cell_size) as usize).min(self.height - 1);
        let max_z = ((end_local.z / self.cell_size) as usize).min(self.depth - 1);

        for z in min_z..=max_z {
            for y in min_y..=max_y {
                for x in min_x..=max_x {
                    let idx = x + y * self.width + z * self.width * self.height;
                    self.cells[idx].push(id);
                }
            }
        }
    }

    pub fn query(&self, p: Vec3, radius: f32, buffer: &mut Vec<usize>) {
        // ... (Existing implementation) ...
        buffer.clear();
        let min = p - Vec3::splat(radius);
        let max = p + Vec3::splat(radius);

        let start_local = (min - self.min).max(Vec3::ZERO);
        let end_local = max - self.min;

        let min_x = (start_local.x / self.cell_size) as usize;
        let min_y = (start_local.y / self.cell_size) as usize;
        let min_z = (start_local.z / self.cell_size) as usize;

        if min_x >= self.width || min_y >= self.height || min_z >= self.depth {
            return;
        }

        let max_x = ((end_local.x / self.cell_size) as usize).min(self.width - 1);
        let max_y = ((end_local.y / self.cell_size) as usize).min(self.height - 1);
        let max_z = ((end_local.z / self.cell_size) as usize).min(self.depth - 1);

        for z in min_z..=max_z {
            for y in min_y..=max_y {
                for x in min_x..=max_x {
                    let idx = x + y * self.width + z * self.width * self.height;
                    buffer.extend_from_slice(&self.cells[idx]);
                }
            }
        }

        buffer.sort_unstable();
        buffer.dedup();
    }
}