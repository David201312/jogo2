import * as THREE from 'three';

export class Pickup {
    constructor(game, type = 'medkit', position = new THREE.Vector3()) {
        this.game = game;
        this.type = type; // medkit, armor, ammo, rifle, cannon

        this.config = {
            medkit: { color: 0x00ff66, size: 0.4, label: 'MEDKIT' },
            armor: { color: 0xfefe33, size: 0.5, label: 'ARMOR' },
            ammo: { color: 0x00f2ff, size: 0.3, label: 'AMMO' },
            rifle: { color: 0xffaa00, size: 0.6, label: 'RIFLE' },
            cannon: { color: 0xff00ff, size: 0.8, label: 'CANNON' }
        };

        this.mesh = this.createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = 0.5;

        this.isDead = false;
    }

    createMesh() {
        const cfg = this.config[this.type] || this.config.medkit;
        const group = new THREE.Group();

        const geom = new THREE.OctahedronGeometry(cfg.size);
        const mat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            emissive: cfg.color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });

        const mesh = new THREE.Mesh(geom, mat);
        group.add(mesh);

        // Rotating ring
        const ringGeom = new THREE.TorusGeometry(cfg.size * 1.5, 0.02, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: cfg.color });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        return group;
    }

    update(delta, playerPos) {
        if (this.isDead) return;

        // Animate
        this.mesh.rotation.y += delta;
        this.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.005) * 0.2;

        // Check distance to player
        const dist = this.mesh.position.distanceTo(playerPos);
        if (dist < 1.5) {
            this.collect();
        }
    }

    collect() {
        this.isDead = true;
        const p = this.game.player;

        switch (this.type) {
            case 'medkit': p.health = Math.min(100, p.health + 25); break;
            case 'armor': p.armor = Math.min(100, p.armor + 50); break;
            case 'rifle': this.game.switchWeapon('rifle'); break;
            case 'cannon': this.game.switchWeapon('cannon'); break;
        }

        this.game.updateHUD();
        this.game.removeEntity(this);
    }
}
