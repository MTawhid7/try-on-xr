// physics/src/collision/mod.rs
pub mod collider;
pub mod geometry;
pub mod resolver;
pub mod self_collision;
pub mod spatial_hash;
mod preprocessing;

// FIX: Re-export these structs so other files can import them
// via `crate::collision::MeshCollider` instead of `crate::collision::collider::MeshCollider`
pub use collider::MeshCollider;
pub use resolver::CollisionResolver;