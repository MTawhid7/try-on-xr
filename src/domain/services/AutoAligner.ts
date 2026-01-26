// src/domain/services/AutoAligner.ts
import * as THREE from 'three';
import { MeshAnalyzer } from './MeshAnalyzer';

export class AutoAligner {
    /**
     * Rotates the mesh so its longest dimension aligns with the Y-axis (Up).
     * This fixes assets exported with Z-up (Blender/CAD) or X-up.
     */
    static fixOrientation(mesh: THREE.Mesh) {
        // Ensure bounding box is accurate
        mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);

        // If Y is already the dominant axis, do nothing.
        if (size.y >= size.x && size.y >= size.z) {
            return;
        }

        console.log(`[AutoAligner] Fixing Orientation for ${mesh.name}. Dimensions: ${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}`);

        // We rotate around the center to avoid flying off into space
        const center = new THREE.Vector3();
        box.getCenter(center);
        mesh.position.sub(center);
        mesh.updateMatrixWorld(true);

        if (size.x > size.y && size.x > size.z) {
            // Longest along X -> Rotate Z -90 degrees
            console.log(" -> Rotating Z -90");
            mesh.rotateZ(-Math.PI / 2);
        } else if (size.z > size.y && size.z > size.x) {
            // Longest along Z -> Rotate X -90 degrees (Standard Blender Fix)
            console.log(" -> Rotating X -90");
            mesh.rotateX(-Math.PI / 2);
        }

        mesh.updateMatrixWorld(true);

        // Re-center roughly
        const newBox = new THREE.Box3().setFromObject(mesh);
        newBox.getCenter(center);
        mesh.position.sub(center);
        mesh.updateMatrixWorld(true);
    }

    static alignBody(geometry: THREE.BufferGeometry): THREE.Box3 {
        // 1. Analyze (Regression)
        const anchors = MeshAnalyzer.analyzeBody(geometry);

        // 2. Center the PELVIS on (0,0,0)
        const offsetX = -anchors.pelvisCenter.x;
        const offsetZ = -anchors.pelvisCenter.y;

        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;
        const offsetY = -box.min.y;

        geometry.translate(offsetX, offsetY, offsetZ);
        geometry.computeBoundingBox();
        return geometry.boundingBox!;
    }

    static alignGarmentToBody(garmentGeo: THREE.BufferGeometry, bodyGeo: THREE.BufferGeometry) {
        const anchors = MeshAnalyzer.analyzeBody(bodyGeo);

        garmentGeo.computeBoundingBox();
        const gBox = garmentGeo.boundingBox!;

        const shirtTopY = gBox.max.y;
        const shirtCenterX = (gBox.min.x + gBox.max.x) / 2;
        const shirtCenterZ = (gBox.min.z + gBox.max.z) / 2;

        // X/Z: Align Shirt Center to Body NECK Center
        const moveX = anchors.neckCenter.x - shirtCenterX;
        const moveZ = anchors.neckCenter.y - shirtCenterZ;

        // Y: Align Shirt Top to Body Neck (+2cm buffer)
        const moveY = (anchors.neckY - shirtTopY) + 0.02;

        garmentGeo.translate(moveX, moveY, moveZ);

        garmentGeo.computeBoundingBox();
        garmentGeo.computeBoundingSphere();
    }
}