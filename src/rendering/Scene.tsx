// src/rendering/Scene.tsx
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { useSimulationStore } from '../app/store/simulation/useSimulationStore';
import { GarmentMesh } from './GarmentMesh';
import { MannequinMesh } from './MannequinMesh';

// NEW: Camera Controller
const CameraRig = () => {
    const { camera, controls } = useThree();
    const { isReady } = useSimulationStore();

    useEffect(() => {
        if (isReady) {
            // Reset Camera Position (Front View)
            camera.position.set(0, 1.4, 2.5);
            camera.lookAt(0, 1.0, 0);

            // Reset Orbit Target to Chest Height
            if (controls) {
                // @ts-ignore
                controls.target.set(0, 1.0, 0);
                // @ts-ignore
                controls.update();
            }
        }
    }, [isReady, camera, controls]);

    return null;
};

export const Scene = () => {
    const { loadAndInitialize, isReady, isLoading, error, isInteracting } = useSimulationStore();

    useEffect(() => {
        loadAndInitialize();
    }, [loadAndInitialize]);

    if (error) return <div style={{ color: 'red', padding: 20 }}>Error: {error}</div>;
    if (isLoading) return <div style={{ color: 'white', padding: 20 }}>Loading Assets & Physics...</div>;

    return (
        <Canvas shadows camera={{ position: [0, 1.5, 2.5], fov: 50 }}>
            <color attach="background" args={['#1a1a1a']} />

            <CameraRig />

            <OrbitControls
                makeDefault
                enabled={!isInteracting}
                minDistance={1.0}
                maxDistance={5.0}
            />

            <ambientLight intensity={0.5} />
            <directionalLight
                position={[5, 10, 5]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />
            <Environment preset="city" />

            {isReady && (
                <group>
                    <MannequinMesh />
                    <GarmentMesh />
                </group>
            )}

            <Grid args={[10, 10]} cellColor="#444" sectionColor="#666" />
        </Canvas>
    );
};