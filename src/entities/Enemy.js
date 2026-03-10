import * as THREE from 'three';
import { Projectile } from './Projectile.js';

export class Enemy {
    constructor(game, type, position) {
        this.game = game;
        this.type = type;
        this.isDead = false;

        this.config = {
            light: { health: 30, speed: 6, color: 0x00f2ff, size: [0.8, 1.8, 0.8] },
            medium: { health: 60, speed: 4, color: 0xffff00, size: [1.2, 2.0, 1.2] },
            heavy: { health: 150, speed: 2, color: 0xff0055, size: [1.8, 2.5, 1.8] },
            boss: { health: 2000, speed: 1.5, color: 0xff0000, size: [4, 6, 4] }
        };

        const cfg = this.config[type] || this.config.light;
        this.health = cfg.health;
        this.speed = cfg.speed;
        this.weaponType = type === 'boss' ? 'super_machine_gun' : (type === 'heavy' ? 'cannon' : (type === 'medium' ? 'rifle' : 'pistol'));

        this.mesh = this._createMesh(cfg);
        this.mesh.position.copy(position);

        this.shootInterval = type === 'boss' ? 0.15 : (4.0 + Math.random() * 3.0);
        this.shootCooldown = this.shootInterval + Math.random() * 2; // initial random delay
    }

    _createMesh(cfg) {
        const group = new THREE.Group();

        // Body
        const geom = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
        this.bodyMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            emissive: cfg.color,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(geom, this.bodyMat);
        body.position.y = cfg.size[1] / 2;
        group.add(body);

        // Eye / Core
        const eyeGeom = new THREE.SphereGeometry(cfg.size[0] * 0.3, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: cfg.color });
        const eye = new THREE.Mesh(eyeGeom, eyeMat);
        eye.position.set(0, cfg.size[1] * 0.7, cfg.size[2] * 0.4);
        group.add(eye);

        // Weapon pod
        const podGeom = new THREE.BoxGeometry(0.4, 0.4, 1.2);
        const pod = new THREE.Mesh(podGeom, this.bodyMat);
        pod.position.set(cfg.size[0] * 0.6, cfg.size[1] * 0.5, 0);
        group.add(pod);

        group.castShadow = true;
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

        // --- Scenery Collision Detection ---
        this._handleSceneryCollision();

        // --- Enemy-to-Enemy collision avoidance ---
        this.game.enemies.forEach(other => {
            if (other === this || other.isDead) return;
            const dist = this.mesh.position.distanceTo(other.mesh.position);
            const minDist = (this.config[this.type].size[0] + other.config[other.type].size[0]) * 0.8;
            if (dist < minDist) {
                const pushDir = new THREE.Vector3().subVectors(this.mesh.position, other.mesh.position).normalize();
                this.mesh.position.addScaledVector(pushDir, (minDist - dist) * 0.5);
            }
        });

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

    _handleSceneryCollision() {
        if (!this.game.collidables) return;

        const enemyRadius = this.config[this.type].size[0] / 2;
        const enemyPos = this.mesh.position;

        for (const obj of this.game.collidables) {
            const box = new THREE.Box3().setFromObject(obj);
            const expandedBox = box.clone().expandByScalar(enemyRadius);

            if (expandedBox.containsPoint(enemyPos)) {
                const closestPoint = new THREE.Vector3();
                box.clampPoint(enemyPos, closestPoint);
                const pushDir = new THREE.Vector3().subVectors(enemyPos, closestPoint);
                pushDir.y = 0;
                if (pushDir.lengthSq() < 0.0001) pushDir.set(1, 0, 0);
                pushDir.normalize();

                enemyPos.x = closestPoint.x + pushDir.x * enemyRadius;
                enemyPos.z = closestPoint.z + pushDir.z * enemyRadius;
            }
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

        const projType = this.weaponType === 'super_machine_gun' ? 'bullet' : (this.weaponType === 'pistol' ? 'plasma' : (this.weaponType === 'rifle' ? 'bullet' : 'heavy'));
        const proj = new Projectile(this.game.scene, startPos, dir, projType);
        proj.speed *= this.type === 'boss' ? 1.2 : 0.3; // Boss bullets are much faster
        proj.damage = this.type === 'boss' ? 10 : (this.type === 'heavy' ? 15 : (this.type === 'medium' ? 8 : 5));
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
