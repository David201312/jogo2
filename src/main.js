import { Game } from './core/Game.js';
import { PlayerControls } from './core/Controls.js';

import { Weapon } from './entities/Weapon.js';
import { Projectile } from './entities/Projectile.js';
import { Enemy } from './entities/Enemy.js';
import { Pickup } from './entities/Pickup.js';
import * as THREE from 'three';

class VoidSentinel extends Game {
  constructor() {
    super();
    this.controls = new PlayerControls(this.camera, this.renderer.domElement);
    this.cameraGroup = this.controls.getObject();
    this.scene.add(this.cameraGroup);

    // Add weapon to camera (view model)
    this.currentWeapon = new Weapon(this, 'pistol');
    this.camera.add(this.currentWeapon.mesh);
    this.currentWeapon.mesh.position.set(0.3, -0.2, -0.5);

    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];

    this.player.totalEnemies = 10;
    this.spawnEnemies();
    this.spawnInitialItems();

    // Move player away from center to see something
    this.cameraGroup.position.set(0, 1.7, 10);

    this.setupUI();
    this.setupInput();
    this.gameOver = false;
  }

  spawnEnemies() {
    const types = ['light', 'medium', 'heavy'];
    for (let i = 0; i < this.player.totalEnemies; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      const enemy = new Enemy(this, type, new THREE.Vector3(x, 0, z));
      this.enemies.push(enemy);
      this.addEntity(enemy);
    }
  }

  spawnInitialItems() {
    const types = ['medkit', 'armor', 'medkit', 'armor'];
    this.waypoints.forEach((wp, i) => {
      if (i < types.length) {
        this.spawnPickup(wp, types[i]);
      }
    });
  }

  spawnPickup(position, type) {
    const pickup = new Pickup(this, type, position.clone());
    this.pickups.push(pickup);
    this.addEntity(pickup);
  }

  switchWeapon(type) {
    this.camera.remove(this.currentWeapon.mesh);
    this.currentWeapon = new Weapon(this, type);
    this.camera.add(this.currentWeapon.mesh);
    this.currentWeapon.mesh.position.set(0.3, -0.2, -0.5);
  }

  setupInput() {
    window.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement && e.button === 0) {
        this.currentWeapon.shoot(this.camera);
      }
    });
  }

  setupUI() {
    this.healthVal = document.getElementById('health-value');
    this.armorVal = document.getElementById('armor-value');
    this.healthFill = document.getElementById('health-fill');
    this.armorFill = document.getElementById('armor-fill');
    this.enemyCount = document.getElementById('enemy-count');

    this.updateHUD();
  }

  updateHUD() {
    this.healthVal.innerText = Math.round(this.player.health);
    this.armorVal.innerText = Math.round(this.player.armor);
    this.healthFill.style.width = `${this.player.health}%`;
    this.armorFill.style.width = `${this.player.armor}%`;
    this.enemyCount.innerText = this.player.totalEnemies - this.player.enemiesKilled;
  }

  update(delta) {
    if (this.gameOver) return;
    super.update(delta);
    this.controls.update(delta);
    const playerPos = this.controls.getObject().position;

    if (this.currentWeapon) {
      this.currentWeapon.update(delta, this.controls);
    }

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(delta, playerPos);
      if (enemy.isDead) this.enemies.splice(i, 1);
    }

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.update(delta, playerPos);
      if (pickup.isDead) this.pickups.splice(i, 1);
    }

    // Update projectiles & Collision
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      if (ent instanceof Projectile) {
        ent.update(delta);

        // Collision check
        if (ent.owner === 'enemy') {
          if (ent.mesh.position.distanceTo(playerPos) < 1.0) {
            this.damagePlayer(ent.damage);
            ent.destroy();
          }
        } else {
          for (const enemy of this.enemies) {
            if (ent.mesh.position.distanceTo(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0))) < 1.0) {
              enemy.takeDamage(ent.damage);
              ent.destroy();
              break;
            }
          }
        }

        if (ent.isDead) this.removeEntity(ent);
      }
    }

    this.checkWinCondition();
    this.checkPortalCollision(playerPos);
  }

  checkPortalCollision(playerPos) {
    if (this.victoryPortal && playerPos.distanceTo(this.victoryPortal.position) < 3) {
      this.triggerGameOver(true);
    }
  }

  damagePlayer(amount) {
    if (this.player.armor > 0) {
      const shieldDamage = amount * 0.7;
      const healthDamage = amount * 0.3;
      this.player.armor -= shieldDamage;
      if (this.player.armor < 0) {
        this.player.health += this.player.armor; // Apply leftover to health
        this.player.armor = 0;
      }
      this.player.health -= healthDamage;
    } else {
      this.player.health -= amount;
    }

    if (this.player.health <= 0) {
      this.player.health = 0;
      this.triggerGameOver(false);
    }
    this.shake(0.4, 0.2);
    this.updateHUD();
  }

  checkWinCondition() {
    if (this.player.enemiesKilled >= this.player.totalEnemies && !this.victoryPortal) {
      this.spawnExitPortal();
    }
  }

  spawnExitPortal() {
    const portalGeom = new THREE.TorusGeometry(3, 0.5, 16, 100);
    const portalMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5 });
    this.victoryPortal = new THREE.Mesh(portalGeom, portalMat);
    this.victoryPortal.position.set(0, 3, 0);
    this.scene.add(this.victoryPortal);

    const light = new THREE.PointLight(0x00f2ff, 10, 20);
    this.victoryPortal.add(light);
  }

  triggerGameOver(win) {
    this.gameOver = true;
    document.getElementById('mission-status').innerText = win ? "Mission Accomplished" : "Sentinel Down";
    document.getElementById('mission-status').classList.add('visible');
    document.exitPointerLock();
  }
}

// Start the game
new VoidSentinel();
