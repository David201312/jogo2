import * as THREE from 'three';

export class PlayerControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isSprinting = false;

        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();

        this.pitch = new THREE.Object3D();
        this.yaw = new THREE.Object3D();
        this.yaw.add(this.pitch);
        this.pitch.add(camera);

        // Initial position
        this.yaw.position.y = 1.7; // Eye level

        this.init();
    }

    init() {
        const onKeyDown = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
                case 'Space': if (this.canJump) this.velocity.y += 10; this.canJump = false; break;
                case 'ShiftLeft': this.isSprinting = true; break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
                case 'ShiftLeft': this.isSprinting = false; break;
            }
        };

        const onMouseMove = (event) => {
            if (document.pointerLockElement !== this.domElement) return;

            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;

            this.yaw.rotation.y -= movementX * 0.002;
            this.pitch.rotation.x -= movementY * 0.002;
            this.pitch.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch.rotation.x));
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('mousemove', onMouseMove);

        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });
    }

    update(delta) {
        if (document.pointerLockElement !== this.domElement) return;

        const friction = 10.0;
        const speed = this.isSprinting ? 80.0 : 40.0;

        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;
        this.velocity.y -= 9.8 * 2.0 * delta; // Gravity

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * speed * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * speed * delta;

        this.yaw.translateX(-this.velocity.x * delta);
        this.yaw.translateZ(this.velocity.z * delta);
        this.yaw.position.y += this.velocity.y * delta;

        if (this.yaw.position.y < 1.7) {
            this.velocity.y = 0;
            this.yaw.position.y = 1.7;
            this.canJump = true;
        }
    }

    getObject() {
        return this.yaw;
    }
}
