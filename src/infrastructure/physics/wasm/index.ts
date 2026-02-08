
// src/infrastructure/physics/wasm/index.ts

// Point to the generated JS/Wasm bindings in the same directory
import init, {
    PhysicsEngine,
    profiler_get_report,
    profiler_reset,
    profiler_set_enabled,
    initThreadPool,
    type InitOutput
} from './garment_physics';

// Re-export as named and default for compatibility
export default init;
export { init, PhysicsEngine, profiler_get_report, profiler_reset, profiler_set_enabled, initThreadPool };
export type { InitOutput };