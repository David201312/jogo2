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

    // Controls
    this.controls = new PlayerControls(this.camera, this.renderer.domElement);
    this.scene.add(this.controls.getObject());

    // Weapon (attached to camera as viewmodel)
    this.currentWeapon = new Weapon(this, 'pistol');
    this.camera.add(this.currentWeapon.mesh);
    this.currentWeapon.mesh.position.set(0.25, -0.18, -0.4);

    // Game state arrays
    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
    this.gameOver = false;
    this.victoryPortal = null;

    // Spawn enemies
    this.player.totalEnemies = 10;
    this._spawnEnemies();

    // Spawn initial items at waypoints
    this._spawnInitialItems();

    // HUD
    this._setupUI();
    this._setupInput();

    console.log('[VoidSentinel] Game initialized — Enemies:', this.enemies.length);
  }

  // ─── Spawning ───────────────────────────────────────────

  _spawnEnemies() {
    const types = ['light', 'light', 'medium', 'medium', 'medium', 'heavy'];
    for (let i = 0; i < this.player.totalEnemies; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      // Spawn at random positions but away from player start (z=15)
      let x, z;
      do {
        x = (Math.random() - 0.5) * 40;
        z = (Math.random() - 0.5) * 40;
      } while (Math.abs(x) < 5 && z > 8); // avoid spawning right on the player

      const enemy = new Enemy(this, type, new THREE.Vector3(x, 0, z));
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
    }
  }

  _spawnInitialItems() {
    const itemTypes = ['medkit', 'armor', 'medkit', 'armor', 'medkit'];
    this.waypoints.forEach((wp, i) => {
      if (i < itemTypes.length) {
        const pickup = new Pickup(this, itemTypes[i], wp.clone());
        this.pickups.push(pickup);
        this.scene.add(pickup.mesh);
      }
    });
  }

  spawnPickup(position, type) {
    const pickup = new Pickup(this, type, position.clone());
    this.pickups.push(pickup);
    this.scene.add(pickup.mesh);
  }

  switchWeapon(type) {
    if (this.currentWeapon.type === type) return;
    this.camera.remove(this.currentWeapon.mesh);
    this.currentWeapon = new Weapon(this, type);
    this.camera.add(this.currentWeapon.mesh);
    this.currentWeapon.mesh.position.set(0.25, -0.18, -0.4);
  }

  // ─── Input ──────────────────────────────────────────────

  _setupInput() {
    window.addEventListener('mousedown', (e) => {
      if (this.controls.enabled && e.button === 0) {
        const proj = this.currentWeapon.shoot(this.camera);
        if (proj) this.projectiles.push(proj);
      }
    });
  }

  // ─── HUD ────────────────────────────────────────────────

  _setupUI() {
    this.ui = {
      healthVal: document.getElementById('health-value'),
      armorVal: document.getElementById('armor-value'),
      healthFill: document.getElementById('health-fill'),
      armorFill: document.getElementById('armor-fill'),
      enemyCount: document.getElementById('enemy-count'),
      missionStatus: document.getElementById('mission-status'),
      weaponName: document.getElementById('weapon-name')
    };
    this.updateHUD();
  }

  updateHUD() {
    const hp = Math.round(Math.max(0, this.player.health));
    const ap = Math.round(Math.max(0, this.player.armor));
    const remaining = this.player.totalEnemies - this.player.enemiesKilled;

    this.ui.healthVal.innerText = hp;
    this.ui.armorVal.innerText = ap;
    this.ui.healthFill.style.width = `${hp}%`;
    this.ui.armorFill.style.width = `${ap}%`;
    this.ui.enemyCount.innerText = remaining;

    if (this.ui.weaponName) {
      this.ui.weaponName.innerText = this.currentWeapon.type.toUpperCase();
    }
  }

  // ─── Game Loop ──────────────────────────────────────────

  update(delta) {
    if (this.gameOver) {
      // Still render particles in base
      super.update(delta);
      return;
    }

    super.update(delta); // dust particles, camera shake
    this.controls.update(delta);

    // Pause game logic if not started/paused (pointer not locked)
    if (!this.controls.enabled) return;

    const playerPos = this.controls.getPosition();

    // Weapon sway
    this.currentWeapon.update(delta, this.controls);

    // Update enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        this.enemies.splice(i, 1);
        continue;
      }
      enemy.update(delta, playerPos);
    }

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      if (pickup.isDead) {
        this.pickups.splice(i, 1);
        continue;
      }
      pickup.update(delta, playerPos);
    }

    // Update projectiles & collision
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (proj.isDead) {
        this.projectiles.splice(i, 1);
        continue;
      }

      proj.update(delta);

      if (proj.owner === 'enemy') {
        // Enemy projectile hitting player
        if (proj.mesh.position.distanceTo(playerPos) < 1.2) {
          this._damagePlayer(proj.damage);
          proj.destroy();
        }
      } else {
        // Player projectile hitting enemy
        for (const enemy of this.enemies) {
          if (enemy.isDead) continue;
          const enemyCenter = enemy.mesh.position.clone();
          enemyCenter.y += 1;
          if (proj.mesh.position.distanceTo(enemyCenter) < 1.2) {
            enemy.takeDamage(proj.damage);
            proj.destroy();
            break;
          }
        }
      }
    }

    // Victory check
    this._checkWin();

    // Portal collision
    if (this.victoryPortal) {
      this.victoryPortal.rotation.y += delta * 2;
      this.victoryPortal.rotation.x += delta * 0.5;
      if (playerPos.distanceTo(this.victoryPortal.position) < 3.5) {
        this._triggerGameOver(true);
      }
    }
  }

  // ─── Game Events ────────────────────────────────────────

  onEnemyKilled(enemy) {
    this.player.enemiesKilled++;
    this.updateHUD();

    // Drop weapon pickup
    this.spawnPickup(enemy.mesh.position, enemy.weaponType);
  }

  _damagePlayer(amount) {
    console.log('[VoidSentinel] Taking damage:', amount, 'Current HP:', this.player.health, 'Armor:', this.player.armor);
    if (this.player.armor > 0) {
      const armorAbsorb = amount * 0.6;
      const healthDmg = amount * 0.4;
      this.player.armor = Math.max(0, this.player.armor - armorAbsorb);
      this.player.health -= healthDmg;
    } else {
      this.player.health -= amount;
    }

    this.shake(0.3, 0.15);
    this.updateHUD();

    if (this.player.health <= 0) {
      this.player.health = 0;
      this.updateHUD();
      this._triggerGameOver(false);
    }
  }

  _checkWin() {
    if (this.player.enemiesKilled >= this.player.totalEnemies && !this.victoryPortal) {
      this._spawnExitPortal();
    }
  }

  _spawnExitPortal() {
    const group = new THREE.Group();

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.4, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.6 })
    );
    group.add(ring);

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    group.add(inner);

    const light = new THREE.PointLight(0x00f2ff, 15, 30);
    group.add(light);

    group.position.set(0, 3, 0);
    this.scene.add(group);
    this.victoryPortal = group;

    console.log('[VoidSentinel] EXIT PORTAL SPAWNED — reach the center!');
  }

  _triggerGameOver(win) {
    this.gameOver = true;
    this.ui.missionStatus.innerText = win ? 'MISSION ACCOMPLISHED' : 'SENTINEL DOWN';
    this.ui.missionStatus.classList.add('visible');

    try { document.exitPointerLock(); } catch (_) { /* ignore */ }

    console.log('[VoidSentinel] Game Over:', win ? 'WIN' : 'LOSE');
  }
}

// ─── Start ──────────────────────────────────────────────
new VoidSentinel();
