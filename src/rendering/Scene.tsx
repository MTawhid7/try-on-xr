// src/rendering/Scene.tsx
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { useSimulationStore } from '../app/store/simulationStore';
import { GarmentMesh } from './GarmentMesh';
import { MannequinMesh } from './MannequinMesh';

export const Scene = () => {
    const { loadAndInitialize, isReady, isLoading, error } = useSimulationStore();

    useEffect(() => {
        loadAndInitialize();
    }, [loadAndInitialize]);

    if (error) return <div style={{ color: 'red', padding: 20 }}>Error: {error}</div>;
    if (isLoading) return <div style={{ color: 'white', padding: 20 }}>Loading Assets & Physics...</div>;

    return (
        <Canvas shadows camera={{ position: [0, 1.5, 2], fov: 50 }}>
            <color attach="background" args={['#1a1a1a']} />

            <OrbitControls target={[0, 1.0, 0]} makeDefault />

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight
                position={[5, 10, 5]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />
            <Environment preset="city" />

            {/* Simulation Content */}
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