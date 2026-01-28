// src/infrastructure/physics/wasm/index.ts

// FIX: Point to the actual output directory 'src/physics-pkg'
// Relative path: Up 3 levels to 'src', then into 'physics-pkg'
import init, { PhysicsEngine, type InitOutput } from '../../../physics-pkg/garment_physics';

export { init, PhysicsEngine };
export type { InitOutput };