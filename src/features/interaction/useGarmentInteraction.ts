// src/features/interaction/useGarmentInteraction.ts
import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../app/store/simulationStore';

export function useGarmentInteraction(meshRef: React.RefObject<THREE.Mesh | null>) {
    const { camera, raycaster, gl } = useThree();
    // Destructure setInteracting
    const { grabParticle, moveParticle, releaseParticle, isRunning, setInteracting } = useSimulationStore();

    const isDragging = useRef(false);
    const dragPlane = useRef(new THREE.Plane());
    const intersectPoint = new THREE.Vector3();

    useEffect(() => {
        const canvas = gl.domElement;

        const handleDown = (e: PointerEvent) => {
            if (!isRunning || !meshRef.current) return;

            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
            const intersects = raycaster.intersectObject(meshRef.current);

            if (intersects.length > 0) {
                const hit = intersects[0];

                if (hit.face) {
                    const geo = meshRef.current.geometry;
                    const posAttr = geo.attributes.position;
                    const a = hit.face.a;
                    const b = hit.face.b;
                    const c = hit.face.c;
                    const pA = new THREE.Vector3().fromBufferAttribute(posAttr, a);
                    const pB = new THREE.Vector3().fromBufferAttribute(posAttr, b);
                    const pC = new THREE.Vector3().fromBufferAttribute(posAttr, c);
                    const dA = pA.distanceToSquared(hit.point);
                    const dB = pB.distanceToSquared(hit.point);
                    const dC = pC.distanceToSquared(hit.point);
                    let closestIdx = a;
                    if (dB < dA && dB < dC) closestIdx = b;
                    if (dC < dA && dC < dB) closestIdx = c;

                    // START DRAG
                    isDragging.current = true;
                    setInteracting(true); // <--- DISABLE ORBIT CONTROLS

                    const normal = new THREE.Vector3();
                    camera.getWorldDirection(normal);
                    dragPlane.current.setFromNormalAndCoplanarPoint(normal, hit.point);

                    grabParticle(closestIdx, [hit.point.x, hit.point.y, hit.point.z]);

                    if ((gl.domElement as any).style) {
                        (gl.domElement as any).style.cursor = 'grabbing';
                    }
                }
            }
        };

        const handleMove = (e: PointerEvent) => {
            if (!isDragging.current) return;

            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

            if (raycaster.ray.intersectPlane(dragPlane.current, intersectPoint)) {
                moveParticle([intersectPoint.x, intersectPoint.y, intersectPoint.z]);
            }
        };

        const handleUp = () => {
            if (isDragging.current) {
                // STOP DRAG
                isDragging.current = false;
                setInteracting(false); // <--- RE-ENABLE ORBIT CONTROLS

                releaseParticle();
                if ((gl.domElement as any).style) {
                    (gl.domElement as any).style.cursor = 'auto';
                }
            }
        };

        canvas.addEventListener('pointerdown', handleDown);
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        // Handle case where mouse leaves window while dragging
        canvas.addEventListener('pointerleave', handleUp);

        return () => {
            canvas.removeEventListener('pointerdown', handleDown);
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            canvas.removeEventListener('pointerleave', handleUp);
        };
    }, [camera, raycaster, gl, isRunning, grabParticle, moveParticle, releaseParticle, meshRef, setInteracting]);
}