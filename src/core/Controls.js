import * as THREE from 'three';

export class PlayerControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = true;
        this.isSprinting = false;
        this.enabled = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.pitch = new THREE.Object3D();
        this.yaw = new THREE.Object3D();
        this.yaw.add(this.pitch);
        this.pitch.add(camera);

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
            if (!this.enabled) return;
            this.yaw.rotation.y -= e.movementX * 0.002;
            this.pitch.rotation.x -= e.movementY * 0.002;
            this.pitch.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch.rotation.x));
        });

        document.body.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.enabled = document.pointerLockElement === this.domElement;
        });
    }

    update(delta) {
        // Always apply gravity even if not locked (so player doesn't float)
        this.velocity.y -= 25 * delta; // gravity

        if (this.enabled) {
            const speed = this.isSprinting ? 30 : 16;
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
        }

        this.yaw.position.y += this.velocity.y * delta;

        // Ground check
        if (this.yaw.position.y < 1.7) {
            this.velocity.y = 0;
            this.yaw.position.y = 1.7;
            this.canJump = true;
        }

        // Keep inside room bounds
        const limit = 23;
        this.yaw.position.x = Math.max(-limit, Math.min(limit, this.yaw.position.x));
        this.yaw.position.z = Math.max(-limit, Math.min(limit, this.yaw.position.z));
    }

    getObject() {
        return this.yaw;
    }

    getPosition() {
        return this.yaw.position;
    }
}
