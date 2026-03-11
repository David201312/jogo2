import * as THREE from 'three';

export class PlayerControls {
    constructor(game, camera, domElement) {
        this.game = game;
        this.camera = camera;
        this.domElement = domElement;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = true;
        this.isSprinting = false;
        this.enabled = false;
        this.isLockedOut = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.pitch = new THREE.Object3D();
        this.yaw = new THREE.Object3D();
        this.shakeGroup = new THREE.Group(); // New: isolated container for shake effects

        this.yaw.add(this.pitch);
        this.pitch.add(this.shakeGroup);
        this.shakeGroup.add(camera);

        // Initial position
        this.yaw.position.set(0, 1.7, 15);

        this._bindEvents();
    }

    _bindEvents() {
        window.addEventListener('keydown', (e) => {
            switch (e.code) {
                case 'ArrowUp': case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft': case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown': case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight': case 'KeyD': this.moveRight = true; break;
                case 'Space':
                    if (this.canJump) { this.velocity.y = 8; this.canJump = false; }
                    break;
                case 'ShiftLeft': case 'ShiftRight': this.isSprinting = true; break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'ArrowUp': case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft': case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown': case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight': case 'KeyD': this.moveRight = false; break;
                case 'ShiftLeft': case 'ShiftRight': this.isSprinting = false; break;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.enabled || this.justLocked) return;

            // Fix for random snapping: ignore deltas that are too large (e.g. > 400px in one frame)
            // This happens in some browsers when the pointer lock is acquired or lost, 
            // or when the OS cursor behavior conflicts with the browser lock.
            if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;

            this.yaw.rotation.y -= e.movementX * 0.002;
            this.pitch.rotation.x -= e.movementY * 0.002;
            this.pitch.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch.rotation.x));
        });

        document.body.addEventListener('click', (e) => {
            if (this.isLockedOut) return;
            // Evitar travar denovo se o jogador clicar no botao
            if (e.target.tagName.toLowerCase() === 'button') return;
            this.domElement.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.enabled = document.pointerLockElement === this.domElement;

            // Add a tiny cooldown after locking to ignore browser-generated spikes
            if (this.enabled) {
                this.justLocked = true;
                setTimeout(() => { this.justLocked = false; }, 100);
            }

            const hud = document.getElementById('hud');
            const overlay = document.getElementById('start-overlay');
            const missionStatus = document.getElementById('mission-status');

            if (this.enabled) {
                if (hud) hud.style.display = 'flex';
                if (overlay) overlay.style.display = 'none';
            } else {
                if (!missionStatus || !missionStatus.classList.contains('visible')) {
                    if (overlay) overlay.style.display = 'flex';
                }
            }
        });
    }

    update(delta) {
        // Always apply gravity even if not locked (so player doesn't float)
        this.velocity.y -= 25 * delta; // gravity

        if (this.enabled) {
            const speed = this.isSprinting ? 90 : 48;
            const friction = 8;

            this.velocity.x -= this.velocity.x * friction * delta;
            this.velocity.z -= this.velocity.z * friction * delta;

            this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
            this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
            this.direction.normalize();

            if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * speed * delta;
            if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * speed * delta;

            this.yaw.translateX(-this.velocity.x * delta);
            this.yaw.translateZ(this.velocity.z * delta);

            // --- Scenery Collision Detection ---
            this._handleSceneryCollision();
        }

        this.yaw.position.y += this.velocity.y * delta;

        // Ground check
        if (this.yaw.position.y < 1.7) {
            this.velocity.y = 0;
            this.yaw.position.y = 1.7;
            this.canJump = true;
        }

        // Keep inside room bounds (legacy fallback)
        const limit = 45;
        this.yaw.position.x = Math.max(-limit, Math.min(limit, this.yaw.position.x));
        this.yaw.position.z = Math.max(-limit, Math.min(limit, this.yaw.position.z));
    }

    _handleSceneryCollision() {
        if (!this.game.collidables) return;

        const playerRadius = 0.8;
        const playerPos = this.yaw.position;

        for (const obj of this.game.collidables) {
            // Simple AABB collision check
            const box = new THREE.Box3().setFromObject(obj);

            // Expand box by player radius for collision
            const expandedBox = box.clone().expandByScalar(playerRadius);

            if (expandedBox.containsPoint(playerPos)) {
                // Find nearest point on original box to push player out
                const closestPoint = new THREE.Vector3();
                box.clampPoint(playerPos, closestPoint);
                const pushDir = new THREE.Vector3().subVectors(playerPos, closestPoint);

                // Only push on X and Z
                pushDir.y = 0;
                if (pushDir.lengthSq() < 0.0001) {
                    // Player center is inside or exactly on edge, push in X
                    pushDir.set(1, 0, 0);
                }

                pushDir.normalize();

                // Snap player position to just outside the box
                playerPos.x = closestPoint.x + pushDir.x * playerRadius;
                playerPos.z = closestPoint.z + pushDir.z * playerRadius;
            }
        }
    }

    getObject() {
        return this.yaw;
    }

    getPosition() {
        return this.yaw.position;
    }
}
