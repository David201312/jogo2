import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class Weapon {
    constructor(game, type = 'pistol') {
        this.game = game;
        this.type = type;
        this.lastFireTime = 0;

        this.config = {
            pistol: { fireRate: 0.4, projType: 'plasma', color: 0x00f2ff, scale: [0.08, 0.08, 0.35] },
            rifle: { fireRate: 0.12, projType: 'bullet', color: 0xffff00, scale: [0.06, 0.06, 0.6] },
            cannon: { fireRate: 0.9, projType: 'heavy', color: 0xff00ff, scale: [0.15, 0.15, 0.7] },
            super_machine_gun: { fireRate: 0.05, projType: 'bullet', color: 0xff2200, scale: [0.12, 0.12, 0.8] }
        };

        this.mesh = this._createMesh();
    }

    _createMesh() {
        const { color, scale } = this.config[this.type];
        const group = new THREE.Group();

        // Gun body
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(scale[0], scale[1], scale[2]),
            new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 1, roughness: 0.15 })
        );
        group.add(body);

        // Barrel glow tip
        const tip = new THREE.Mesh(
            new THREE.SphereGeometry(scale[0] * 0.8, 6, 6),
            new THREE.MeshBasicMaterial({ color })
        );
        tip.position.z = -scale[2] / 2;
        group.add(tip);

        // Small light on barrel removed for performance
        // const tipLight = new THREE.PointLight(color, 0.5, 2);
        // tip.add(tipLight);

        return group;
    }

    shoot(camera) {
        const now = performance.now() / 1000;
        const cfg = this.config[this.type];
        if (now - this.lastFireTime < cfg.fireRate) return null;
        this.lastFireTime = now;

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);

        const pos = new THREE.Vector3();
        camera.getWorldPosition(pos);
        pos.addScaledVector(dir, 0.8);

        if (this.game.player.ammo[this.type] <= 0) return null;
        this.game.player.ammo[this.type]--;
        this.game.updateHUD();

        const proj = new Projectile(this.game, pos, dir, cfg.projType);
        proj.owner = 'player';

        // Recoil
        this.mesh.position.z += 0.08;

        // Shake
        const shakePower = this.type === 'cannon' ? 0.25 : (this.type === 'rifle' ? 0.03 : 0.015);
        this.game.shake(shakePower, 0.08);

        return proj;
    }

    update(delta, controls) {
        // Recoil recovery
        this.mesh.position.z += (0 - this.mesh.position.z) * 12 * delta;

        // Weapon sway
        if (controls) {
            const swayX = (controls.moveLeft ? 1 : (controls.moveRight ? -1 : 0)) * 0.015;
            const targetX = 0.25 + swayX;
            const targetY = -0.18 + Math.sin(Date.now() * 0.004) * 0.005;

            this.mesh.position.x += (targetX - this.mesh.position.x) * 6 * delta;
            this.mesh.position.y += (targetY - this.mesh.position.y) * 6 * delta;
        }
    }
}
