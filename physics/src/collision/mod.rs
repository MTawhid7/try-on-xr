// physics/src/collision/mod.rs
pub mod geometry;
pub mod spatial;
pub mod collider;
pub mod resolver;
pub mod self_collision;
mod preprocessing;

pub use collider::MeshCollider;
pub use resolver::CollisionResolver;

// FIX: Suppress warning since we aren't using this in the main loop yet
#[allow(unused_imports)]
pub use self_collision::SelfCollision;