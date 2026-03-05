import * as THREE from 'three';

export class Particles {
    constructor(scene, count = 1000) {
        this.scene = scene;
        this.count = count;

        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i++) {
            pos[i] = (Math.random() - 0.5) * 100;
        }

        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));

        const mat = new THREE.PointsMaterial({
            color: 0x00f2ff,
            size: 0.1,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(geom, mat);
        this.scene.add(this.points);
    }

    update(delta) {
        this.points.rotation.y += delta * 0.05;
        this.points.rotation.x += delta * 0.02;
    }
}
