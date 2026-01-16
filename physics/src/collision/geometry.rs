// physics/src/collision/geometry.rs
use glam::Vec3;

#[derive(Clone, Copy, Debug)]
pub struct Triangle {
    pub v0: Vec3,
    pub v1: Vec3,
    pub v2: Vec3,
    #[allow(dead_code)] // Suppress warning
    pub index: usize,
}

impl Triangle {
    pub fn new(v0: Vec3, v1: Vec3, v2: Vec3, index: usize) -> Self {
        Self { v0, v1, v2, index }
    }

    pub fn aabb(&self) -> (Vec3, Vec3) {
        let min = self.v0.min(self.v1).min(self.v2);
        let max = self.v0.max(self.v1).max(self.v2);
        (min, max)
    }

    /// Finds the closest point on this triangle to a given point `p`.
    /// Returns the point and the barycentric coordinates (u, v, w).
    pub fn closest_point(&self, p: Vec3) -> (Vec3, [f32; 3]) {
        let ab = self.v1 - self.v0;
        let ac = self.v2 - self.v0;
        let ap = p - self.v0;

        let d1 = ab.dot(ap);
        let d2 = ac.dot(ap);

        if d1 <= 0.0 && d2 <= 0.0 {
            return (self.v0, [1.0, 0.0, 0.0]);
        }

        let bp = p - self.v1;
        let d3 = ab.dot(bp);
        let d4 = ac.dot(bp);

        if d3 >= 0.0 && d4 <= d3 {
            return (self.v1, [0.0, 1.0, 0.0]);
        }

        let vc = d1 * d4 - d3 * d2;
        if vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0 {
            let v = d1 / (d1 - d3);
            return (self.v0 + ab * v, [1.0 - v, v, 0.0]);
        }

        let cp = p - self.v2;
        let d5 = ab.dot(cp);
        let d6 = ac.dot(cp);

        if d6 >= 0.0 && d5 <= d6 {
            return (self.v2, [0.0, 0.0, 1.0]);
        }

        let vb = d5 * d2 - d1 * d6;
        if vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0 {
            let w = d2 / (d2 - d6);
            return (self.v0 + ac * w, [1.0 - w, 0.0, w]);
        }

        let va = d3 * d6 - d5 * d4;
        if va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0 {
            let w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
            return (self.v1 + (self.v2 - self.v1) * w, [0.0, 1.0 - w, w]);
        }

        let denom = 1.0 / (va + vb + vc);
        let v = vb * denom;
        let w = vc * denom;
        let u = 1.0 - v - w;

        (self.v0 + ab * v + ac * w, [u, v, w])
    }
}