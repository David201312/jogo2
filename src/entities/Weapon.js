import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class Weapon {
    constructor(game, type = 'pistol') {
        this.game = game;
        this.type = type;
        this.lastFireTime = 0;

        this.config = {
            pistol: { fireRate: 0.5, damage: 20, color: 0x00f2ff, scale: [0.1, 0.1, 0.4] },
            rifle: { fireRate: 0.15, damage: 15, color: 0xffff00, scale: [0.12, 0.12, 0.8] },
            cannon: { fireRate: 1.0, damage: 100, color: 0xff00ff, scale: [0.3, 0.3, 1.2] }
        };

        this.mesh = this.createMesh();
    }

    createMesh() {
        const { color, scale } = this.config[this.type];
        const group = new THREE.Group();

        const bodyGeom = new THREE.BoxGeometry(...scale);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 1, roughness: 0.2 });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        group.add(body);

        // Barrel glow
        const glowGeom = new THREE.CylinderGeometry(scale[0] * 0.5, scale[0] * 0.5, 0.1);
        const glowMat = new THREE.MeshBasicMaterial({ color: color });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.rotation.x = Math.PI / 2;
        glow.position.z = scale[2] / 2;
        group.add(glow);

        return group;
    }

    shoot(camera) {
        const now = performance.now() / 1000;
        if (now - this.lastFireTime < this.config[this.type].fireRate) return;

        this.lastFireTime = now;

        // Projectile direction
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        // Projectile start position (offset from camera)
        const position = camera.position.clone();
        position.add(direction.clone().multiplyScalar(0.5));

        const projType = this.type === 'pistol' ? 'plasma' : (this.type === 'rifle' ? 'bullet' : 'heavy');
        const projectile = new Projectile(this.game.scene, position, direction, projType);
        this.game.addEntity(projectile);

        // Simple recoil effect
        this.mesh.position.z += 0.1;

        // Shake
        const shakePower = this.type === 'cannon' ? 0.3 : (this.type === 'rifle' ? 0.05 : 0.02);
        this.game.shake(shakePower, 0.1);
    }

    update(delta, controls) {
        // Smooth recoil recovery
        this.mesh.position.z += (0 - this.mesh.position.z) * 10 * delta;

        // Weapon Sway
        const swayAmount = 0.02;
        const movementX = controls.moveLeft ? 1 : (controls.moveRight ? -1 : 0);
        const movementZ = controls.moveForward ? 1 : (controls.moveBackward ? -1 : 0);

        const targetX = 0.3 + (movementX * swayAmount);
        const targetY = -0.2 + (Math.sin(Date.now() * 0.005) * 0.01); // Bobbing

        this.mesh.position.x += (targetX - this.mesh.position.x) * 5 * delta;
        this.mesh.position.y += (targetY - this.mesh.position.y) * 5 * delta;
    }
}
