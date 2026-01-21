// physics/src/collision/collider.rs
use glam::Vec3;
use super::geometry::Triangle;
use super::spatial_hash::StaticSpatialHash;
use super::preprocessing;

pub struct MeshCollider {
    #[allow(dead_code)]
    pub vertices: Vec<Vec3>,
    pub normals: Vec<Vec3>,
    pub indices: Vec<u32>,
    pub triangles: Vec<Triangle>,
    pub spatial_hash: StaticSpatialHash,
    // NEW: Global Bounds for fast culling
    pub aabb_min: Vec3,
    pub aabb_max: Vec3,
}

impl MeshCollider {
    pub fn new(raw_vertices: Vec<f32>, _raw_normals: Vec<f32>, indices: Vec<u32>) -> Self {
        // 1. Preprocess
        let processed = preprocessing::process_mesh(&raw_vertices, &indices);

        // 2. Calculate Bounds
        let mut min_bound = Vec3::splat(f32::MAX);
        let mut max_bound = Vec3::splat(f32::MIN);

        for &v in &processed.vertices {
            min_bound = min_bound.min(v);
            max_bound = max_bound.max(v);
        }

        // 3. Initialize Static Hash
        let mut spatial_hash = StaticSpatialHash::new(min_bound, max_bound, 0.1);
        let mut triangles = Vec::new();

        // 4. Build Triangles
        let num_triangles = indices.len() / 3;
        for i in 0..num_triangles {
            let idx0 = indices[i * 3] as usize;
            let idx1 = indices[i * 3 + 1] as usize;
            let idx2 = indices[i * 3 + 2] as usize;

            let v0 = processed.vertices[idx0];
            let v1 = processed.vertices[idx1];
            let v2 = processed.vertices[idx2];

            let tri = Triangle::new(v0, v1, v2, i);
            let (min, max) = tri.aabb();

            triangles.push(tri);
            spatial_hash.insert_aabb(i, min, max);
        }

        MeshCollider {
            vertices: processed.vertices,
            normals: processed.normals,
            indices,
            triangles,
            spatial_hash,
            // Store bounds
            aabb_min: min_bound,
            aabb_max: max_bound,
        }
    }

    /// Fast AABB check to skip particles far from the mesh
    #[inline]
    pub fn contains_point(&self, p: Vec3, margin: f32) -> bool {
        p.x >= self.aabb_min.x - margin && p.x <= self.aabb_max.x + margin &&
        p.y >= self.aabb_min.y - margin && p.y <= self.aabb_max.y + margin &&
        p.z >= self.aabb_min.z - margin && p.z <= self.aabb_max.z + margin
    }

    pub fn query_closest(&self, p: Vec3, max_dist: f32, buffer: &mut Vec<usize>) -> Option<(Vec3, Vec3, f32)> {
        // Optimization: The caller (CollisionResolver) should call contains_point first.
        // But we keep the hash query logic here.

        self.spatial_hash.query(p, max_dist, buffer);

        let mut best_dist_sq = max_dist * max_dist;
        let mut best_result = None;

        for &tri_idx in buffer.iter() {
            let tri = &self.triangles[tri_idx];
            let (closest, bary) = tri.closest_point(p);
            let dist_sq = closest.distance_squared(p);

            if dist_sq < best_dist_sq {
                best_dist_sq = dist_sq;

                let idx0 = self.indices[tri_idx * 3] as usize;
                let idx1 = self.indices[tri_idx * 3 + 1] as usize;
                let idx2 = self.indices[tri_idx * 3 + 2] as usize;

                let n0 = self.normals[idx0];
                let n1 = self.normals[idx1];
                let n2 = self.normals[idx2];
                let smooth_normal = (n0 * bary[0] + n1 * bary[1] + n2 * bary[2]).normalize();

                best_result = Some((closest, smooth_normal, dist_sq.sqrt()));
            }
        }

        best_result
    }
}