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
    // Removed unused aabb_min/max fields
}

impl MeshCollider {
    pub fn new(raw_vertices: Vec<f32>, _raw_normals: Vec<f32>, indices: Vec<u32>) -> Self {
        let processed = preprocessing::process_mesh(&raw_vertices, &indices);

        let mut min_bound = Vec3::splat(f32::MAX);
        let mut max_bound = Vec3::splat(f32::MIN);

        for &v in &processed.vertices {
            min_bound = min_bound.min(v);
            max_bound = max_bound.max(v);
        }

        let mut spatial_hash = StaticSpatialHash::new(min_bound, max_bound, 0.1);
        let mut triangles = Vec::new();

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
        }
    }

    // Removed unused query_closest and contains_point methods.
    // The CollisionResolver now accesses spatial_hash and triangles directly.
}