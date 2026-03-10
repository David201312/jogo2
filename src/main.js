import { Game } from './core/Game.js';
import { PlayerControls } from './core/Controls.js';
import { Weapon } from './entities/Weapon.js';
import { Projectile } from './entities/Projectile.js';
import { Enemy } from './entities/Enemy.js';
import { Pickup } from './entities/Pickup.js';
import { Minimap } from './ui/Minimap.js';
import * as THREE from 'three';

class VoidSentinel extends Game {
  constructor() {
    super();

    // Controls
    this.controls = new PlayerControls(this, this.camera, this.renderer.domElement);
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
    this.currentLevel = 1;
    this.isMouseDown = false; // Track mouse state for auto-fire

    // Weapon Inventory
    this.inventory = ['pistol'];
    this.currentWeaponIndex = 0;

    // Spawn enemies
    this.player.totalEnemies = 15;
    this._spawnEnemies();

    // Spawn initial items at waypoints
    this._spawnInitialItems();

    // HUD
    // Minimap
    this.minimap = new Minimap(this);

    this._setupUI();
    this._setupInput();

    console.log('[VoidSentinel] Game initialized — Enemies:', this.enemies.length);
  }

  // ─── Spawning ───────────────────────────────────────────

  _spawnEnemies() {
    if (this.isBossFight) {
      this.player.totalEnemies = 1;
      const boss = new Enemy(this, 'boss', new THREE.Vector3(0, 0, -10));
      this.enemies.push(boss);
      this.scene.add(boss.mesh);
      return;
    }

    const types = this.isInfiniteWaves ? ['medium', 'heavy', 'heavy', 'light'] : ['light', 'light', 'medium', 'medium', 'medium', 'heavy'];
    for (let i = 0; i < this.player.totalEnemies; i++) {
      const type = types[Math.floor(Math.random() * types.length)];

      // Pick a random waypoint to spawn near (rooms)
      const wp = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
      const x = wp.x + (Math.random() - 0.5) * 10;
      const z = wp.z + (Math.random() - 0.5) * 10;

      const enemy = new Enemy(this, type, new THREE.Vector3(x, 0, z));
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
    }
  }

  _spawnBossFightPickups(delta) {
    if (!this.lastPickupSpawn) this.lastPickupSpawn = 0;
    this.lastPickupSpawn += delta;

    if (this.lastPickupSpawn > 2.5) { // Spawn item every 2.5 seconds
      this.lastPickupSpawn = 0;
      const types = ['medkit', 'armor', 'pistol', 'rifle', 'cannon'];
      const type = types[Math.floor(Math.random() * types.length)];
      const x = (Math.random() - 0.5) * 40;
      const z = (Math.random() - 0.5) * 40;
      this.spawnPickup(new THREE.Vector3(x, 0, z), type);
    }
  }

  _spawnEmptyRoom() {
    this.clearEnvironment();

    // Simple boss floor
    const floorGeom = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    this.bossFloor = new THREE.Mesh(floorGeom, floorMat);
    this.bossFloor.rotation.x = -Math.PI / 2;
    this.envGroup.add(this.bossFloor);

    // Grid helper
    this.bossGrid = new THREE.GridHelper(100, 40, 0xff0000, 0x220000);
    this.envGroup.add(this.bossGrid);

    // Simple walls for collision (80x80)
    this.createRoom(0, 0, 80, 80);

    // Add waypoints for boss fight spawns
    this.waypoints = [
      new THREE.Vector3(20, 0, 20),
      new THREE.Vector3(-20, 0, 20),
      new THREE.Vector3(20, 0, -20),
      new THREE.Vector3(-20, 0, -20)
    ];
  }

  _restoreEnvironment() {
    this.clearEnvironment();
    this.buildEnvironment();
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

  switchWeapon(typeOrIdx) {
    if (typeof typeOrIdx === 'string') {
      // Pickup logic: add to inventory if new
      if (!this.inventory.includes(typeOrIdx)) {
        this.inventory.push(typeOrIdx);
      }
      this.currentWeaponIndex = this.inventory.indexOf(typeOrIdx);
    } else {
      // Scroll logic: cycle through inventory
      this.currentWeaponIndex = (this.currentWeaponIndex + typeOrIdx + this.inventory.length) % this.inventory.length;
    }

    const newType = this.inventory[this.currentWeaponIndex];
    if (this.currentWeapon && this.currentWeapon.type === newType) return;

    if (this.currentWeapon) this.camera.remove(this.currentWeapon.mesh);
    this.currentWeapon = new Weapon(this, newType);
    this.camera.add(this.currentWeapon.mesh);
    this.currentWeapon.mesh.position.set(0.25, -0.18, -0.4);
    this.updateHUD();
  }

  // ─── Input ──────────────────────────────────────────────

  _setupInput() {
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isMouseDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
    });

    window.addEventListener('wheel', (e) => {
      if (this.controls.enabled && !this.gameOver) {
        const dir = e.deltaY > 0 ? 1 : -1;
        this.switchWeapon(dir);
      }
    }, { passive: true });
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
      restartBtn: document.getElementById('restart-btn'),
      weaponName: document.getElementById('weapon-name'),
      ammoVal: document.getElementById('ammo-value'),
      scoreVal: document.getElementById('score-value')
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
    if (this.ui.ammoVal) {
      this.ui.ammoVal.innerText = this.player.ammo[this.currentWeapon.type];
    }
    if (this.ui.scoreVal) {
      this.ui.scoreVal.innerText = this.player.score;
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

    // Auto-fire logic
    if (this.isMouseDown && this.controls.enabled && !this.gameOver) {
      const proj = this.currentWeapon.shoot(this.camera);
      if (proj) this.projectiles.push(proj);
    }

    if (this.isBossFight && !this.gameOver) {
      this._spawnBossFightPickups(delta);
    }

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
          // Optimized distance check without object cloning
          const dx = proj.mesh.position.x - enemy.mesh.position.x;
          const dy = proj.mesh.position.y - (enemy.mesh.position.y + 1);
          const dz = proj.mesh.position.z - enemy.mesh.position.z;
          if (dx * dx + dy * dy + dz * dz < 1.44) { // 1.2 * 1.2
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
        this._nextLevel();
      }
    }

    if (this.minimap) {
      this.minimap.update();
    }
  }

  _nextLevel() {
    this.currentLevel++;
    this.player.score += 500;
    this.player.enemiesKilled = 0;
    this.player.totalEnemies = 15 + (this.currentLevel - 1) * 5;

    // Clear state
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
    this.pickups.forEach(p => this.scene.remove(p.mesh));
    this.pickups = [];
    this.projectiles.forEach(p => p.destroy());
    this.projectiles = [];

    if (this.victoryPortal) {
      this.scene.remove(this.victoryPortal);
      this.victoryPortal = null;
    }

    // Reset player position
    this.controls.yaw.position.set(0, 1.7, 5);

    // Re-spawn
    if (this.currentLevel === 6 && !this.isInfiniteWaves) {
      this.isBossFight = true;
      this._spawnEmptyRoom();
      this._spawnEnemies();
    } else if (this.isBossFight && this.player.enemiesKilled >= 1) {
      // This branch might be redundant if we handle it in onEnemyKilled/portal
      // but let's ensure transition
    } else {
      if (this.isInfiniteWaves) {
        this.player.totalEnemies = 10;
      }
      this._spawnEnemies();
      this._spawnInitialItems();
    }

    // Status message
    const msg = document.getElementById('mission-status');
    if (msg) {
      let text = `LEVEL ${this.currentLevel} - DESTROY ALL SENTINELS`;
      if (this.isBossFight) text = "BOSS FIGHT - DESTROY THE VOID CORE";
      if (this.isInfiniteWaves) text = `WAVE ${this.currentLevel - 6} - SURVIVE INFINITY`;

      msg.innerText = text;
      msg.style.display = 'block';
      setTimeout(() => { if (!this.gameOver) msg.style.display = 'none'; }, 3000);
    }

    this.updateHUD();
  }

  // ─── Game Events ────────────────────────────────────────

  onEnemyKilled(enemy) {
    this.player.enemiesKilled++;
    this.player.score += 100;
    this.updateHUD();

    if (enemy.type === 'boss') {
      this.isBossFight = false;
      this.isInfiniteWaves = true;
      this._restoreEnvironment();
      // Drop super machine gun
      this.spawnPickup(enemy.mesh.position, 'super_machine_gun');
    } else {
      // Drop weapon pickup
      this.spawnPickup(enemy.mesh.position, enemy.weaponType);
    }
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
    this.controls.isLockedOut = true;
    this.ui.missionStatus.innerText = win ? 'MISSION ACCOMPLISHED' : 'SENTINEL DOWN';
    this.ui.missionStatus.classList.add('visible');

    if (this.ui.restartBtn) {
      this.ui.restartBtn.classList.add('visible');
    }

    try { document.exitPointerLock(); } catch (_) { /* ignore */ }

    console.log('[VoidSentinel] Game Over:', win ? 'WIN' : 'LOSE');
  }
}

// ─── Start ──────────────────────────────────────────────
new VoidSentinel();
