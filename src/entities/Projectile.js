import * as THREE from 'three';

export class Projectile {
    constructor(scene, position, direction, type = 'plasma') {
        this.scene = scene;
        this.direction = direction.clone().normalize();
        this.speed = 50;
        this.lifeTime = 2; // seconds
        this.damage = type === 'plasma' ? 50 : 20;

        const colors = {
            plasma: 0x00f2ff,
            bullet: 0xffff00,
            heavy: 0xff00ff
        };

        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: colors[type] || 0xffffff,
            transparent: true,
            opacity: 0.8
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        // Light for the projectile
        this.light = new THREE.PointLight(colors[type], 1, 3);
        this.mesh.add(this.light);

        this.isDead = false;
    }

    update(delta) {
        if (this.isDead) return;

        this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed * delta));
        this.lifeTime -= delta;

        if (this.lifeTime <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.isDead = true;
        this.scene.remove(this.mesh);
    }
}
