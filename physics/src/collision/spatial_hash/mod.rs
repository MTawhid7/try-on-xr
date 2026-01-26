// physics/src/collision/spatial_hash/mod.rs
mod dynamic;
mod static_grid;

pub use dynamic::SpatialHash;
pub use static_grid::StaticSpatialHash;