// src/rendering/MannequinMesh.tsx
import { useSimulationStore } from '../app/store/simulation/useSimulationStore';

export const MannequinMesh = () => {
    const { assets } = useSimulationStore();

    // Use the High-Res Visual Body
    const geometry = assets?.visualBody;

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} receiveShadow castShadow>
            <meshStandardMaterial
                color="#f5f5f5"      // Off-white / Clay
                roughness={0.6}      // Matte but smooth
                metalness={0.1}      // Slight specular highlight
            />
        </mesh>
    );
};