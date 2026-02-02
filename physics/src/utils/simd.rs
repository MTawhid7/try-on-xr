// physics/src/utils/simd.rs

//! SIMD utilities for vectorized physics computations.
//! Uses WASM SIMD128 intrinsics for 4-wide parallel operations.
//!
//! This module is conditionally compiled - when targeting WASM with SIMD,
//! it uses real SIMD intrinsics. Otherwise, it falls back to scalar emulation.
//!
//! NOTE: Some helper methods (min, lane, select, etc.) are currently unused but
//! are retained as a complete API for future optimizations (e.g., SoA layouts,
//! temporal coherence, more advanced SIMD patterns).
#![allow(dead_code)]

#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
use std::arch::wasm32::*;

/// 4-wide f32 vector wrapper for constraint solving.
/// Provides safe abstractions over WASM SIMD intrinsics.
#[derive(Clone, Copy)]
pub struct F32x4 {
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    data: v128,
    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    data: [f32; 4],
}

impl F32x4 {
    /// Create from 4 scalar values.
    #[inline(always)]
    pub fn new(a: f32, b: f32, c: f32, d: f32) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4(a, b, c, d) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self { data: [a, b, c, d] }
        }
    }

    /// Splat a single value to all lanes.
    #[inline(always)]
    pub fn splat(v: f32) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_splat(v) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self { data: [v, v, v, v] }
        }
    }

    /// Element-wise addition.
    #[inline(always)]
    pub fn add(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_add(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    self.data[0] + rhs.data[0],
                    self.data[1] + rhs.data[1],
                    self.data[2] + rhs.data[2],
                    self.data[3] + rhs.data[3],
                ],
            }
        }
    }

    /// Element-wise subtraction.
    #[inline(always)]
    pub fn sub(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_sub(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    self.data[0] - rhs.data[0],
                    self.data[1] - rhs.data[1],
                    self.data[2] - rhs.data[2],
                    self.data[3] - rhs.data[3],
                ],
            }
        }
    }

    /// Element-wise multiplication.
    #[inline(always)]
    pub fn mul(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_mul(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    self.data[0] * rhs.data[0],
                    self.data[1] * rhs.data[1],
                    self.data[2] * rhs.data[2],
                    self.data[3] * rhs.data[3],
                ],
            }
        }
    }

    /// Element-wise division.
    #[inline(always)]
    pub fn div(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_div(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    self.data[0] / rhs.data[0],
                    self.data[1] / rhs.data[1],
                    self.data[2] / rhs.data[2],
                    self.data[3] / rhs.data[3],
                ],
            }
        }
    }

    /// Element-wise negation.
    #[inline(always)]
    pub fn neg(self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_neg(self.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [-self.data[0], -self.data[1], -self.data[2], -self.data[3]],
            }
        }
    }

    /// Element-wise square root.
    #[inline(always)]
    pub fn sqrt(self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_sqrt(self.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    self.data[0].sqrt(),
                    self.data[1].sqrt(),
                    self.data[2].sqrt(),
                    self.data[3].sqrt(),
                ],
            }
        }
    }

    /// Element-wise maximum.
    #[inline(always)]
    pub fn max(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_max(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    self.data[0].max(rhs.data[0]),
                    self.data[1].max(rhs.data[1]),
                    self.data[2].max(rhs.data[2]),
                    self.data[3].max(rhs.data[3]),
                ],
            }
        }
    }

    /// Element-wise minimum.
    #[inline(always)]
    pub fn min(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_min(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    self.data[0].min(rhs.data[0]),
                    self.data[1].min(rhs.data[1]),
                    self.data[2].min(rhs.data[2]),
                    self.data[3].min(rhs.data[3]),
                ],
            }
        }
    }

    /// Extract lane 0.
    #[inline(always)]
    pub fn lane0(self) -> f32 {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            f32x4_extract_lane::<0>(self.data)
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            self.data[0]
        }
    }

    /// Extract lane 1.
    #[inline(always)]
    pub fn lane1(self) -> f32 {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            f32x4_extract_lane::<1>(self.data)
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            self.data[1]
        }
    }

    /// Extract lane 2.
    #[inline(always)]
    pub fn lane2(self) -> f32 {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            f32x4_extract_lane::<2>(self.data)
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            self.data[2]
        }
    }

    /// Extract lane 3.
    #[inline(always)]
    pub fn lane3(self) -> f32 {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            f32x4_extract_lane::<3>(self.data)
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            self.data[3]
        }
    }

    /// Get lane by index.
    #[inline(always)]
    pub fn lane(self, i: usize) -> f32 {
        match i {
            0 => self.lane0(),
            1 => self.lane1(),
            2 => self.lane2(),
            _ => self.lane3(),
        }
    }

    /// Replace lane at index.
    #[inline(always)]
    pub fn replace_lane(self, i: usize, val: f32) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            let result = match i {
                0 => f32x4_replace_lane::<0>(self.data, val),
                1 => f32x4_replace_lane::<1>(self.data, val),
                2 => f32x4_replace_lane::<2>(self.data, val),
                _ => f32x4_replace_lane::<3>(self.data, val),
            };
            Self { data: result }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            let mut data = self.data;
            data[i.min(3)] = val;
            Self { data }
        }
    }

    /// Compare greater than, returns bitmask for select.
    #[inline(always)]
    pub fn gt_mask(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_gt(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    if self.data[0] > rhs.data[0] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                    if self.data[1] > rhs.data[1] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                    if self.data[2] > rhs.data[2] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                    if self.data[3] > rhs.data[3] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                ],
            }
        }
    }

    /// Compare less than, returns bitmask for select.
    #[inline(always)]
    pub fn lt_mask(self, rhs: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: f32x4_lt(self.data, rhs.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    if self.data[0] < rhs.data[0] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                    if self.data[1] < rhs.data[1] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                    if self.data[2] < rhs.data[2] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                    if self.data[3] < rhs.data[3] { f32::from_bits(0xFFFFFFFF) } else { 0.0 },
                ],
            }
        }
    }

    /// Bitwise select: where mask bits are set, take a; else take b.
    #[inline(always)]
    pub fn select(mask: Self, a: Self, b: Self) -> Self {
        #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
        {
            Self { data: v128_bitselect(a.data, b.data, mask.data) }
        }
        #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
        {
            Self {
                data: [
                    if mask.data[0].to_bits() != 0 { a.data[0] } else { b.data[0] },
                    if mask.data[1].to_bits() != 0 { a.data[1] } else { b.data[1] },
                    if mask.data[2].to_bits() != 0 { a.data[2] } else { b.data[2] },
                    if mask.data[3].to_bits() != 0 { a.data[3] } else { b.data[3] },
                ],
            }
        }
    }
}

/// SIMD-accelerated 3D vector (4 Vec3s packed in SoA layout).
/// X components in lanes 0-3, Y in lanes 0-3, Z in lanes 0-3.
#[derive(Clone, Copy)]
pub struct Vec3x4 {
    pub x: F32x4,
    pub y: F32x4,
    pub z: F32x4,
}

impl Vec3x4 {
    /// Create from 4 glam Vec4s (uses xyz, ignores w).
    #[inline(always)]
    pub fn from_vec4s(v0: glam::Vec4, v1: glam::Vec4, v2: glam::Vec4, v3: glam::Vec4) -> Self {
        Self {
            x: F32x4::new(v0.x, v1.x, v2.x, v3.x),
            y: F32x4::new(v0.y, v1.y, v2.y, v3.y),
            z: F32x4::new(v0.z, v1.z, v2.z, v3.z),
        }
    }

    /// Splat a single Vec3 to all lanes.
    #[inline(always)]
    pub fn splat(v: glam::Vec3) -> Self {
        Self {
            x: F32x4::splat(v.x),
            y: F32x4::splat(v.y),
            z: F32x4::splat(v.z),
        }
    }

    /// Element-wise subtraction.
    #[inline(always)]
    pub fn sub(self, rhs: Self) -> Self {
        Self {
            x: self.x.sub(rhs.x),
            y: self.y.sub(rhs.y),
            z: self.z.sub(rhs.z),
        }
    }

    /// Element-wise addition.
    #[inline(always)]
    pub fn add(self, rhs: Self) -> Self {
        Self {
            x: self.x.add(rhs.x),
            y: self.y.add(rhs.y),
            z: self.z.add(rhs.z),
        }
    }

    /// Multiply all components by a scalar F32x4.
    #[inline(always)]
    pub fn mul_scalar(self, s: F32x4) -> Self {
        Self {
            x: self.x.mul(s),
            y: self.y.mul(s),
            z: self.z.mul(s),
        }
    }

    /// Divide all components by a scalar F32x4.
    #[inline(always)]
    pub fn div_scalar(self, s: F32x4) -> Self {
        Self {
            x: self.x.div(s),
            y: self.y.div(s),
            z: self.z.div(s),
        }
    }

    /// Compute length squared for each of the 4 vectors.
    #[inline(always)]
    pub fn length_squared(self) -> F32x4 {
        self.x.mul(self.x)
            .add(self.y.mul(self.y))
            .add(self.z.mul(self.z))
    }

    /// Compute length for each of the 4 vectors.
    #[inline(always)]
    pub fn length(self) -> F32x4 {
        self.length_squared().sqrt()
    }

    /// Normalize each of the 4 vectors (safe, clamps minimum length).
    #[inline(always)]
    pub fn normalize_safe(self) -> Self {
        let len = self.length();
        let safe_len = len.max(F32x4::splat(1e-8));
        self.div_scalar(safe_len)
    }

    /// Extract lane as glam Vec4 (w=0).
    #[inline(always)]
    pub fn extract_lane0(self) -> glam::Vec4 {
        glam::Vec4::new(self.x.lane0(), self.y.lane0(), self.z.lane0(), 0.0)
    }

    #[inline(always)]
    pub fn extract_lane1(self) -> glam::Vec4 {
        glam::Vec4::new(self.x.lane1(), self.y.lane1(), self.z.lane1(), 0.0)
    }

    #[inline(always)]
    pub fn extract_lane2(self) -> glam::Vec4 {
        glam::Vec4::new(self.x.lane2(), self.y.lane2(), self.z.lane2(), 0.0)
    }

    #[inline(always)]
    pub fn extract_lane3(self) -> glam::Vec4 {
        glam::Vec4::new(self.x.lane3(), self.y.lane3(), self.z.lane3(), 0.0)
    }

    /// Extract lane by index.
    #[inline(always)]
    pub fn extract_lane(self, i: usize) -> glam::Vec4 {
        match i {
            0 => self.extract_lane0(),
            1 => self.extract_lane1(),
            2 => self.extract_lane2(),
            _ => self.extract_lane3(),
        }
    }
}
