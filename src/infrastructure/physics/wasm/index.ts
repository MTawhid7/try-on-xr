// src/infrastructure/physics/wasm/index.ts

// FIX: Point to the actual output directory 'src/physics-pkg'
// Relative path: Up 3 levels to 'src', then into 'physics-pkg'
import init, {
    PhysicsEngine,
    profiler_get_report,
    profiler_reset,
    profiler_set_enabled,
    type InitOutput
} from '../../../physics-pkg/garment_physics';

export { init, PhysicsEngine, profiler_get_report, profiler_reset, profiler_set_enabled };
export type { InitOutput };