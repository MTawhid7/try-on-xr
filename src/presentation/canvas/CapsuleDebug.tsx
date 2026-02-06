
import React from 'react';

export const CapsuleDebug: React.FC = () => {
    return (
        <group>
            {/* Torso Cylinder: R=0.2, H=1.5, Center Y=0.7 */}
            <mesh position={[0, 0.7, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 1.5, 32]} />
                <meshStandardMaterial color="gray" transparent opacity={0.5} wireframe />
            </mesh>

            {/* Arm/Shoulder Cylinder: R=0.08, H=0.35, Center Y=1.4, Rotated Z 90 */}
            <mesh position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.08, 0.08, 0.35, 32]} />
                <meshStandardMaterial color="gray" transparent opacity={0.5} wireframe />
            </mesh>
        </group>
    );
};
