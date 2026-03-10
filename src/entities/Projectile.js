import * as THREE from 'three';

export class Projectile {
    constructor(scene, position, direction, type = 'plasma') {
        this.scene = scene;
        this.direction = direction.clone().normalize();
        this.type = type;
        this.owner = 'player'; // 'player' or 'enemy'

        const cfg = {
            plasma: { speed: 60, damage: 25, color: 0x00f2ff, radius: 0.25 },
            bullet: { speed: 80, damage: 15, color: 0xffff00, radius: 0.15 },
            heavy: { speed: 40, damage: 60, color: 0xff00ff, radius: 0.45 }
        };

        const c = cfg[type] || cfg.plasma;
        this.speed = c.speed;
        this.damage = c.damage;
        this.lifeTime = 3;
        this.isDead = false;

        const geom = new THREE.SphereGeometry(c.radius, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: c.color });
        this.mesh = new THREE.Mesh(geom, mat);
        this.mesh.position.copy(position);

        // Glow light removed for performance
        // this.light = new THREE.PointLight(c.color, 2, 5);
        // this.mesh.add(this.light);

        this.scene.add(this.mesh);
    }

    update(delta) {
        if (this.isDead) return;
        this.mesh.position.addScaledVector(this.direction, this.speed * delta);
        this.lifeTime -= delta;
        if (this.lifeTime <= 0) this.destroy();
    }

    destroy() {
        if (this.isDead) return;
        this.isDead = true;
        this.scene.remove(this.mesh);
    }
}
