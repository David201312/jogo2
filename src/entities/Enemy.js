import * as THREE from 'three';

export class Enemy {
    constructor(game, type = 'light', position = new THREE.Vector3()) {
        this.game = game;
        this.type = type;

        this.config = {
            light: { health: 50, speed: 5, color: 0x00ff66, size: [0.8, 1.6, 0.8], weapon: 'pistol' },
            medium: { health: 100, speed: 3, color: 0x00f2ff, size: [1.0, 1.8, 1.0], weapon: 'rifle' },
            heavy: { health: 250, speed: 1.5, color: 0xff00ff, size: [1.5, 2.2, 1.5], weapon: 'cannon' }
        };

        const cfg = this.config[type];
        this.health = cfg.health;
        this.speed = cfg.speed;

        this.mesh = this.createMesh(cfg);
        this.mesh.position.copy(position);

        this.lastShotTime = 0;
        this.shootInterval = 1.5 + Math.random();

        this.isDead = false;
    }

    createMesh(cfg) {
        const group = new THREE.Group();

        const bodyGeom = new THREE.BoxGeometry(...cfg.size);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: cfg.color,
            emissive: cfg.color,
            emissiveIntensity: 0.2,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = cfg.size[1] / 2;
        group.add(body);

        // Eyes (Glow)
        const eyeGeom = new THREE.BoxGeometry(cfg.size[0] * 0.8, 0.1, 0.1);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const eyes = new THREE.Mesh(eyeGeom, eyeMat);
        eyes.position.set(0, cfg.size[1] * 0.8, cfg.size[2] * 0.5);
        group.add(eyes);

        return group;
    }

    update(delta, playerPos) {
        if (this.isDead) return;

        // Move towards player
        const dir = new THREE.Vector3().subVectors(playerPos, this.mesh.position);
        dir.y = 0; // Keep on ground
        const distance = dir.length();
        dir.normalize();

        if (distance > 5) {
            this.mesh.position.add(dir.multiplyScalar(this.speed * delta));
        }

        // Rotate to face player
        this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

        // Shoot logic
        const now = performance.now() / 1000;
        if (distance < 20 && now - this.lastShotTime > this.shootInterval) {
            this.shoot();
            this.lastShotTime = now;
        }
    }

    shoot() {
        // Logic handled by projectile system
        // For simplicity, enemies shoot a ray or projectile
        const direction = new THREE.Vector3().subVectors(this.game.camera.position, this.mesh.position).normalize();
        const startPos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));

        const type = this.config[this.type].weapon;
        const projType = type === 'pistol' ? 'plasma' : (type === 'rifle' ? 'bullet' : 'heavy');

        // Use the same projectile class
        import('./Projectile.js').then(({ Projectile }) => {
            const proj = new Projectile(this.game.scene, startPos, direction, projType);
            proj.damage = this.type === 'heavy' ? 20 : 10;
            proj.owner = 'enemy';
            this.game.addEntity(proj);
        });
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDead) {
            this.die();
        }

        // Flash effect
        this.mesh.children[0].material.emissiveIntensity = 2.0;
        setTimeout(() => {
            if (this.mesh && this.mesh.children[0]) {
                this.mesh.children[0].material.emissiveIntensity = 0.2;
            }
        }, 100);
    }

    die() {
        this.isDead = true;
        this.game.player.enemiesKilled++;
        this.game.updateHUD();

        // Drop loot
        this.game.spawnPickup(this.mesh.position, this.config[this.type].weapon);

        this.game.removeEntity(this);
    }
}
