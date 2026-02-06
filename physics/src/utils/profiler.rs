// physics/src/utils/profiler.rs

//! High-resolution performance profiling for the physics engine.
//! Uses the Web Performance API to measure timing with microsecond precision.
//!
//! # Usage
//! ```rust
//! use crate::utils::profiler::{Profiler, profile_scope};
//!
//! // Method 1: Scoped profiling with automatic timing
//! {
//!     let _timer = profile_scope!("Solver::DistanceConstraint");
//!     // ... code to profile ...
//! } // Timer automatically records on drop
//!
//! // Method 2: Manual profiling
//! Profiler::start("Phase::Integration");
//! // ... code ...
//! Profiler::end("Phase::Integration");
//!
//! // Get results as JSON
//! let json = Profiler::get_report_json();
//! ```

use std::cell::RefCell;
use wasm_bindgen::prelude::*;

#[cfg(feature = "profiling")]
use web_sys::Performance;

// Thread-local profiler state (only compiled with profiling feature)
#[cfg(feature = "profiling")]
thread_local! {
    static PROFILER: RefCell<ProfilerState> = RefCell::new(ProfilerState::new());
}

/// Profiling categories for organized reporting
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[repr(u8)]
pub enum ProfileCategory {
    Frame = 0,
    Integration = 1,
    BroadPhase = 2,
    NarrowPhase = 3,
    Constraints = 4,
    DistanceConstraint = 5,
    BendingConstraint = 6,
    TetherConstraint = 7,
    AreaConstraint = 8,
    CollisionResolve = 9,
    SelfCollision = 10,
    SelfCollisionDetect = 11,
    SelfCollisionColor = 12,
    SelfCollisionResolve = 13,
    Normals = 14,
    Aerodynamics = 15,
    MouseConstraint = 16,
}

impl ProfileCategory {
    pub fn name(&self) -> &'static str {
        match self {
            ProfileCategory::Frame => "Frame",
            ProfileCategory::Integration => "Integration",
            ProfileCategory::BroadPhase => "BroadPhase",
            ProfileCategory::NarrowPhase => "NarrowPhase",
            ProfileCategory::Constraints => "Constraints",
            ProfileCategory::DistanceConstraint => "DistanceConstraint",
            ProfileCategory::BendingConstraint => "BendingConstraint",
            ProfileCategory::TetherConstraint => "TetherConstraint",
            ProfileCategory::AreaConstraint => "AreaConstraint",
            ProfileCategory::CollisionResolve => "CollisionResolve",
            ProfileCategory::SelfCollision => "SelfCollision",
            ProfileCategory::SelfCollisionDetect => "SelfCollisionDetect",
            ProfileCategory::SelfCollisionColor => "SelfCollisionColor",
            ProfileCategory::SelfCollisionResolve => "SelfCollisionResolve",
            ProfileCategory::Normals => "Normals",
            ProfileCategory::Aerodynamics => "Aerodynamics",
            ProfileCategory::MouseConstraint => "MouseConstraint",
        }
    }

    pub const fn count() -> usize {
        17
    }
}

/// Timing statistics for a single category
#[derive(Clone, Debug, Default)]
pub struct TimingStats {
    /// Total accumulated time in ms
    pub total_ms: f64,
    /// Number of samples
    pub count: u32,
    /// Minimum recorded time in ms
    pub min_ms: f64,
    /// Maximum recorded time in ms
    pub max_ms: f64,
    /// Rolling average (exponential moving average)
    pub avg_ms: f64,
    /// Last recorded time
    pub last_ms: f64,
}

impl TimingStats {
    pub fn new() -> Self {
        Self {
            min_ms: f64::MAX,
            max_ms: 0.0,
            ..Default::default()
        }
    }

    pub fn record(&mut self, duration_ms: f64) {
        self.total_ms += duration_ms;
        self.count += 1;
        self.last_ms = duration_ms;
        self.min_ms = self.min_ms.min(duration_ms);
        self.max_ms = self.max_ms.max(duration_ms);

        // Exponential moving average with alpha = 0.1
        const ALPHA: f64 = 0.1;
        if self.count == 1 {
            self.avg_ms = duration_ms;
        } else {
            self.avg_ms = ALPHA * duration_ms + (1.0 - ALPHA) * self.avg_ms;
        }
    }

    pub fn reset(&mut self) {
        *self = Self::new();
    }
}

/// Internal profiler state
#[cfg(feature = "profiling")]
struct ProfilerState {
    performance: Option<Performance>,
    stats: [TimingStats; ProfileCategory::count()],
    start_times: [f64; ProfileCategory::count()],
    frame_count: u32,
    enabled: bool,
}

#[cfg(feature = "profiling")]
impl ProfilerState {
    fn new() -> Self {
        let performance = web_sys::window().and_then(|w| w.performance());

        Self {
            performance,
            stats: std::array::from_fn(|_| TimingStats::new()),
            start_times: [0.0; ProfileCategory::count()],
            frame_count: 0,
            enabled: true,
        }
    }

    fn now(&self) -> f64 {
        self.performance.as_ref().map_or(0.0, |p| p.now())
    }

    fn start(&mut self, category: ProfileCategory) {
        if self.enabled {
            self.start_times[category as usize] = self.now();
        }
    }

    fn end(&mut self, category: ProfileCategory) {
        if self.enabled {
            let start = self.start_times[category as usize];
            let end = self.now();
            let duration = end - start;
            self.stats[category as usize].record(duration);
        }
    }
}

/// Public profiler interface
pub struct Profiler;

impl Profiler {
    /// Start timing a category
    #[inline]
    pub fn start(category: ProfileCategory) {
        #[cfg(feature = "profiling")]
        PROFILER.with(|p| p.borrow_mut().start(category));
    }

    /// End timing a category
    #[inline]
    pub fn end(category: ProfileCategory) {
        #[cfg(feature = "profiling")]
        PROFILER.with(|p| p.borrow_mut().end(category));
    }

    /// Mark the start of a new frame
    #[inline]
    pub fn begin_frame() {
        #[cfg(feature = "profiling")]
        PROFILER.with(|p| {
            let mut profiler = p.borrow_mut();
            profiler.frame_count += 1;
            profiler.start(ProfileCategory::Frame);
        });
    }

    /// Mark the end of a frame
    #[inline]
    pub fn end_frame() {
        #[cfg(feature = "profiling")]
        PROFILER.with(|p| p.borrow_mut().end(ProfileCategory::Frame));
    }

    /// Enable or disable profiling
    pub fn set_enabled(enabled: bool) {
        #[cfg(feature = "profiling")]
        PROFILER.with(|p| p.borrow_mut().enabled = enabled);
        #[cfg(not(feature = "profiling"))]
        let _ = enabled;
    }

    /// Reset all statistics
    pub fn reset() {
        #[cfg(feature = "profiling")]
        PROFILER.with(|p| {
            let mut profiler = p.borrow_mut();
            for stat in &mut profiler.stats {
                stat.reset();
            }
            profiler.frame_count = 0;
        });
    }

    /// Get profiling report as JSON string
    #[cfg(feature = "profiling")]
    pub fn get_report_json() -> String {
        PROFILER.with(|p| {
            let profiler = p.borrow();
            let mut json = String::from("{");

            json.push_str(&format!("\"frameCount\":{},", profiler.frame_count));
            json.push_str("\"categories\":{");

            for (i, cat) in [
                ProfileCategory::Frame,
                ProfileCategory::Integration,
                ProfileCategory::BroadPhase,
                ProfileCategory::NarrowPhase,
                ProfileCategory::Constraints,
                ProfileCategory::DistanceConstraint,
                ProfileCategory::BendingConstraint,
                ProfileCategory::TetherConstraint,
                ProfileCategory::AreaConstraint,
                ProfileCategory::CollisionResolve,
                ProfileCategory::SelfCollision,
                ProfileCategory::SelfCollisionDetect,
                ProfileCategory::SelfCollisionColor,
                ProfileCategory::SelfCollisionResolve,
                ProfileCategory::Normals,
                ProfileCategory::Aerodynamics,
                ProfileCategory::MouseConstraint,
            ].iter().enumerate() {
                let stats = &profiler.stats[*cat as usize];
                if i > 0 {
                    json.push(',');
                }
                json.push_str(&format!(
                    "\"{}\":{{\"avg\":{:.4},\"min\":{:.4},\"max\":{:.4},\"last\":{:.4},\"count\":{}}}",
                    cat.name(),
                    stats.avg_ms,
                    if stats.min_ms == f64::MAX { 0.0 } else { stats.min_ms },
                    stats.max_ms,
                    stats.last_ms,
                    stats.count
                ));
            }

            json.push_str("}}");
            json
        })
    }

    #[cfg(not(feature = "profiling"))]
    pub fn get_report_json() -> String {
        "{}".to_string()
    }

    /// Get timing for a specific category
    #[cfg(feature = "profiling")]
    pub fn get_timing(category: ProfileCategory) -> TimingStats {
        PROFILER.with(|p| p.borrow().stats[category as usize].clone())
    }

    #[cfg(not(feature = "profiling"))]
    pub fn get_timing(_category: ProfileCategory) -> TimingStats {
        TimingStats::new()
    }
}

/// RAII timer for scoped profiling
pub struct ScopedTimer {
    category: ProfileCategory,
}

impl ScopedTimer {
    #[inline]
    pub fn new(category: ProfileCategory) -> Self {
        Profiler::start(category);
        Self { category }
    }
}

impl Drop for ScopedTimer {
    #[inline]
    fn drop(&mut self) {
        Profiler::end(self.category);
    }
}

/// Macro for convenient scoped profiling
#[macro_export]
macro_rules! profile_scope {
    ($category:expr) => {
        let _timer = $crate::utils::profiler::ScopedTimer::new($category);
    };
}

/// Macro for profiling a block of code
#[macro_export]
macro_rules! profile_block {
    ($category:expr, $block:block) => {{
        $crate::utils::profiler::Profiler::start($category);
        let result = $block;
        $crate::utils::profiler::Profiler::end($category);
        result
    }};
}

// WASM-exposed functions for JavaScript access
#[wasm_bindgen]
pub fn profiler_get_report() -> String {
    Profiler::get_report_json()
}

#[wasm_bindgen]
pub fn profiler_reset() {
    Profiler::reset();
}

#[wasm_bindgen]
pub fn profiler_set_enabled(enabled: bool) {
    Profiler::set_enabled(enabled);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timing_stats_record() {
        let mut stats = TimingStats::new();
        stats.record(10.0);
        stats.record(20.0);

        assert_eq!(stats.count, 2);
        assert_eq!(stats.total_ms, 30.0);
        assert_eq!(stats.min_ms, 10.0);
        assert_eq!(stats.max_ms, 20.0);
        assert_eq!(stats.last_ms, 20.0);
    }

    #[test]
    fn test_timing_stats_ema() {
        let mut stats = TimingStats::new();
        for _ in 0..100 {
            stats.record(10.0);
        }
        // EMA should converge to 10.0
        assert!((stats.avg_ms - 10.0).abs() < 0.01);
    }
}
