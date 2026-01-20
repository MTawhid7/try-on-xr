// physics/src/collision/collider.rs
use glam::Vec3;
use super::geometry::Triangle;
use super::spatial_hash::SpatialHash;

pub struct MeshCollider {
    pub vertices: Vec<Vec3>,
    pub normals: Vec<Vec3>,
    pub indices: Vec<u32>,
    pub triangles: Vec<Triangle>,
    pub spatial_hash: SpatialHash,
}

impl MeshCollider {
    // FIX: Removed 'mut' from raw_vertices as it is not mutated
    pub fn new(raw_vertices: Vec<f32>, _raw_normals: Vec<f32>, indices: Vec<u32>) -> Self {
        let num_verts = raw_vertices.len() / 3;

        // 1. Convert to Vec3
        let mut vertices = Vec::with_capacity(num_verts);
        for i in 0..num_verts {
            vertices.push(Vec3::new(
                raw_vertices[i * 3],
                raw_vertices[i * 3 + 1],
                raw_vertices[i * 3 + 2],
            ));
        }

        // 2. Build Adjacency Map
        let mut adj = vec![Vec::new(); num_verts];
        let num_triangles = indices.len() / 3;

        for i in 0..num_triangles {
            let idx0 = indices[i * 3] as usize;
            let idx1 = indices[i * 3 + 1] as usize;
            let idx2 = indices[i * 3 + 2] as usize;

            Self::add_neighbor(&mut adj, idx0, idx1);
            Self::add_neighbor(&mut adj, idx0, idx2);
            Self::add_neighbor(&mut adj, idx1, idx2);
        }

        // 3. Laplacian Smoothing (3 Iterations)
        let iterations = 3;
        let lambda = 0.5;

        for _ in 0..iterations {
            let old_verts = vertices.clone();

            for i in 0..num_verts {
                let neighbors = &adj[i];
                if neighbors.is_empty() { continue; }

                let mut sum = Vec3::ZERO;
                for &n_idx in neighbors {
                    sum += old_verts[n_idx];
                }

                let avg = sum / (neighbors.len() as f32);
                vertices[i] = old_verts[i].lerp(avg, lambda);
            }
        }

        // 4. Re-Calculate Normals
        let mut normals = vec![Vec3::ZERO; num_verts];

        for i in 0..num_triangles {
            let idx0 = indices[i * 3] as usize;
            let idx1 = indices[i * 3 + 1] as usize;
            let idx2 = indices[i * 3 + 2] as usize;

            let v0 = vertices[idx0];
            let v1 = vertices[idx1];
            let v2 = vertices[idx2];

            let edge1 = v1 - v0;
            let edge2 = v2 - v0;
            let face_normal = edge1.cross(edge2); // Weighted by area

            normals[idx0] += face_normal;
            normals[idx1] += face_normal;
            normals[idx2] += face_normal;
        }

        for n in &mut normals {
            *n = n.normalize_or_zero();
        }

        let mut collider = MeshCollider {
            vertices,
            normals,
            indices,
            triangles: Vec::new(),
            spatial_hash: SpatialHash::new(0.1),
        };

        collider.rebuild_bvh();
        collider
    }

    fn add_neighbor(adj: &mut Vec<Vec<usize>>, a: usize, b: usize) {
        if !adj[a].contains(&b) { adj[a].push(b); }
        if !adj[b].contains(&a) { adj[b].push(a); }
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
            self.spatial_hash.insert_aabb(i, min, max);
        }
    }

    pub fn query_closest(&self, p: Vec3, max_dist: f32, buffer: &mut Vec<usize>) -> Option<(Vec3, Vec3, f32)> {
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