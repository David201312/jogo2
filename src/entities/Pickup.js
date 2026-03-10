import * as THREE from 'three';

export class Pickup {
    constructor(game, type = 'medkit', position = new THREE.Vector3()) {
        this.game = game;
        this.type = type;
        this.isDead = false;
        this.config = {
            medkit: { color: 0x00ff66, size: 0.35, heal: 30 },
            armor: { color: 0xfefe33, size: 0.4, armorVal: 40 },
            rifle: { color: 0xffaa00, size: 0.45 },
            cannon: { color: 0xff00ff, size: 0.55 },
            pistol: { color: 0x00f2ff, size: 0.35 }
        };

        this.mesh = this._createMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = 0.6;
    }

    _createMesh() {
        const cfg = this.config[this.type] || this.config.medkit;
        const group = new THREE.Group();

        // Main shape
        const geom = new THREE.OctahedronGeometry(cfg.size);
        const mat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            emissive: cfg.color,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.85,
            metalness: 0.5,
            roughness: 0.2
        });
        group.add(new THREE.Mesh(geom, mat));

        // Ring
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(cfg.size * 1.4, 0.02, 8, 24),
            new THREE.MeshBasicMaterial({ color: cfg.color })
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        // Light removed for performance
        // const light = new THREE.PointLight(cfg.color, 1.5, 6);
        // group.add(light);

        return group;
    }

    update(delta, playerPos) {
        if (this.isDead || !playerPos) return;

        // Animate: rotate and bob
        this.mesh.rotation.y += delta * 1.5;
        this.mesh.position.y = 0.6 + Math.sin(performance.now() * 0.003) * 0.15;

        // Check pickup distance
        if (this.mesh.position.distanceTo(playerPos) < 1.8) {
            this.collect();
        }
    }

    collect() {
        if (this.isDead) return;
        this.isDead = true;

        const p = this.game.player;
        switch (this.type) {
            case 'medkit':
                p.health = Math.min(100, p.health + (this.config.medkit.heal || 30));
                break;
            case 'armor':
                p.armor = Math.min(100, p.armor + (this.config.armor.armorVal || 40));
                break;
            case 'rifle':
                this.game.player.ammo.rifle += 10;
                this.game.switchWeapon('rifle');
                break;
            case 'cannon':
                this.game.player.ammo.cannon += 10;
                this.game.switchWeapon('cannon');
                break;
            case 'pistol':
                this.game.player.ammo.pistol += 10;
                this.game.switchWeapon('pistol');
                break;
        }

        this.game.updateHUD();
        this.game.scene.remove(this.mesh);
    }
}
