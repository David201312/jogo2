import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class Enemy {
    constructor(game, type = 'light', position = new THREE.Vector3()) {
        this.game = game;
        this.type = type;
        this.isDead = false;

        this.config = {
            light: { health: 50, speed: 4, color: 0x00ff66, size: [0.7, 1.5, 0.7], weapon: 'pistol' },
            medium: { health: 100, speed: 2.5, color: 0x00f2ff, size: [0.9, 1.8, 0.9], weapon: 'rifle' },
            heavy: { health: 200, speed: 1.2, color: 0xff00ff, size: [1.3, 2.2, 1.3], weapon: 'cannon' }
        };

        const cfg = this.config[type];
        this.health = cfg.health;
        this.maxHealth = cfg.health;
        this.speed = cfg.speed;
        this.weaponType = cfg.weapon;

        this.mesh = this._createMesh(cfg);
        this.mesh.position.copy(position);

        this.shootInterval = 2 + Math.random() * 1.5;
        this.shootCooldown = this.shootInterval + Math.random() * 2; // initial random delay
    }

    _createMesh(cfg) {
        const group = new THREE.Group();

        // Body
        const bodyGeom = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            emissive: cfg.color,
            emissiveIntensity: 0.3,
            metalness: 0.7,
            roughness: 0.3
        });
        this.bodyMat = bodyMat;
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = cfg.size[1] / 2;
        body.castShadow = true;
        group.add(body);

        // Eyes
        const eyeGeom = new THREE.BoxGeometry(cfg.size[0] * 0.7, 0.12, 0.08);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        const eyes = new THREE.Mesh(eyeGeom, eyeMat);
        eyes.position.set(0, cfg.size[1] * 0.8, cfg.size[2] / 2 + 0.05);
        group.add(eyes);

        // Light on enemy removed for performance
        // const light = new THREE.PointLight(cfg.color, 1, 8);
        // light.position.set(0, cfg.size[1], 0);
        // group.add(light);

        return group;
    }

    update(delta, playerPos) {
        if (this.isDead || !playerPos) return;

        const toPlayer = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        toPlayer.y = 0;
        const distance = toPlayer.length();

        // Move towards player (stop if close)
        if (distance > 4) {
            const moveDir = toPlayer.clone().normalize();
            this.mesh.position.addScaledVector(moveDir, this.speed * delta);
        }

        // Face player
        this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

        // Shoot cooldown logic
        if (this.shootCooldown > 0) {
            this.shootCooldown -= delta;
        } else if (distance < 25) {
            this._shoot(playerPos);
            this.shootCooldown = this.shootInterval;
        }
    }

    _shoot(playerPos) {
        const startPos = this.mesh.position.clone();
        startPos.y += 1.2;

        const dir = new THREE.Vector3().subVectors(playerPos, startPos).normalize();
        // Add some inaccuracy
        dir.x += (Math.random() - 0.5) * 0.1;
        dir.y += (Math.random() - 0.5) * 0.05;
        dir.z += (Math.random() - 0.5) * 0.1;
        dir.normalize();

        const projType = this.weaponType === 'pistol' ? 'plasma' : (this.weaponType === 'rifle' ? 'bullet' : 'heavy');
        const proj = new Projectile(this.game.scene, startPos, dir, projType);
        proj.damage = this.type === 'heavy' ? 15 : (this.type === 'medium' ? 8 : 5);
        proj.owner = 'enemy';
        this.game.projectiles.push(proj);
    }

    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;

        // Flash
        this.bodyMat.emissiveIntensity = 3.0;
        setTimeout(() => {
            if (this.bodyMat) this.bodyMat.emissiveIntensity = 0.3;
        }, 80);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.game.onEnemyKilled(this);
        this.game.scene.remove(this.mesh);
    }
}
