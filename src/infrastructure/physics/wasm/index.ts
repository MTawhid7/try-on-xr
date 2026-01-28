// src/infrastructure/physics/wasm/index.ts

// Import the init function and the PhysicsEngine class from the generated WASM package.
// Note: The path '../pkg/garment_physics' assumes the wasm-pack output is located
// in a 'pkg' folder adjacent to the 'src' folder or configured via bundler aliases.
// For this refactor, we assume the standard Vite/Wasm-pack setup.
import init, { PhysicsEngine, type InitOutput } from '../../../../physics/pkg/garment_physics';

export { init, PhysicsEngine };
export type { InitOutput };