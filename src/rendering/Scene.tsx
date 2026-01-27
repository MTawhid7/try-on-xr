// src/rendering/Scene.tsx
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { useSimulationStore } from '../app/store/simulation/useSimulationStore';
import { GarmentMesh } from './GarmentMesh';
import { MannequinMesh } from './MannequinMesh';

const CameraRig = () => {
    const { camera, controls } = useThree();
    const { isReady } = useSimulationStore();

    useEffect(() => {
        if (isReady) {
            camera.position.set(0, 1.4, 2.5);
            camera.lookAt(0, 1.0, 0);
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
        <Canvas shadows="soft" camera={{ position: [0, 1.5, 2.5], fov: 50 }} dpr={[1, 2]}>
            <color attach="background" args={['#1a1a1a']} />

            <CameraRig />

            <OrbitControls
                makeDefault
                enabled={!isInteracting}
                minDistance={1.0}
                maxDistance={5.0}
            />

            {/* 1. KEY LIGHT */}
            <directionalLight
                position={[5, 10, 5]}
                intensity={1.2}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0001}
                shadow-normalBias={0.02}
            />

            {/* 2. FILL LIGHT (Fixes Black Shadows) */}
            {/* Increased ground intensity (2nd arg) to ensure back is visible */}
            <hemisphereLight
                args={['#ffffff', '#666666', 1.0]}
            />

            {/* 3. ENVIRONMENT */}
            <Environment preset="city" blur={0.8} />

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