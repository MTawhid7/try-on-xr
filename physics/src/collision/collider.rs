// physics/src/collision/collider.rs
use glam::Vec3;
use super::geometry::Triangle;
use super::spatial_hash::SpatialHash;

pub struct MeshCollider {
    vertices: Vec<Vec3>,
    normals: Vec<Vec3>, // Smooth vertex normals
    indices: Vec<u32>,
    triangles: Vec<Triangle>,
    spatial_hash: SpatialHash,
}

impl MeshCollider {
    pub fn new(vertices: Vec<f32>, normals: Vec<f32>, indices: Vec<u32>) -> Self {
        let vertex_count = vertices.len() / 3;
        let mut verts = Vec::with_capacity(vertex_count);
        let mut norms = Vec::with_capacity(vertex_count);

        for i in 0..vertex_count {
            verts.push(Vec3::new(vertices[i*3], vertices[i*3+1], vertices[i*3+2]));
            norms.push(Vec3::new(normals[i*3], normals[i*3+1], normals[i*3+2]));
        }

        let mut collider = MeshCollider {
            vertices: verts,
            normals: norms,
            indices,
            triangles: Vec::new(),
            spatial_hash: SpatialHash::new(0.1), // 10cm cells
        };

        collider.rebuild_bvh();
        collider
    }

    pub fn rebuild_bvh(&mut self) {
        self.triangles.clear();
        self.spatial_hash.clear();

        let num_triangles = self.indices.len() / 3;
        for i in 0..num_triangles {
            let idx0 = self.indices[i * 3] as usize;
            let idx1 = self.indices[i * 3 + 1] as usize;
            let idx2 = self.indices[i * 3 + 2] as usize;

            let v0 = self.vertices[idx0];
            let v1 = self.vertices[idx1];
            let v2 = self.vertices[idx2];

            let tri = Triangle::new(v0, v1, v2, i);
            let (min, max) = tri.aabb();

            self.triangles.push(tri);
            self.spatial_hash.insert(i, min, max);
        }
    }

    /// Queries the collider for the closest point.
    /// Returns (closest_point, smoothed_normal, distance)
    pub fn query_closest(&self, p: Vec3, max_dist: f32) -> Option<(Vec3, Vec3, f32)> {
        let candidates = self.spatial_hash.query(p, max_dist);

        let mut best_dist_sq = max_dist * max_dist;
        let mut best_result = None;

        for &tri_idx in &candidates {
            let tri = &self.triangles[tri_idx];
            let (closest, bary) = tri.closest_point(p);
            let dist_sq = closest.distance_squared(p);

            if dist_sq < best_dist_sq {
                best_dist_sq = dist_sq;

                // --- THE SECRET SAUCE: Interpolated Normals ---
                // Instead of the flat triangle normal, we blend the vertex normals.
                let idx0 = self.indices[tri_idx * 3] as usize;
                let idx1 = self.indices[tri_idx * 3 + 1] as usize;
                let idx2 = self.indices[tri_idx * 3 + 2] as usize;

                let n0 = self.normals[idx0];
                let n1 = self.normals[idx1];
                let n2 = self.normals[idx2];

                // bary = [u, v, w] corresponding to v0, v1, v2
                let smooth_normal = (n0 * bary[0] + n1 * bary[1] + n2 * bary[2]).normalize();

                best_result = Some((closest, smooth_normal, dist_sq.sqrt()));
            }
        }

        best_result
    }
}