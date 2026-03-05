import * as THREE from 'three';
import { Particles } from '../entities/Particles.js';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('app').prepend(this.renderer.domElement);

        this.clock = new THREE.Clock();
        this.entities = [];
        this.lastTime = 0;
        this.shakeAmount = 0;
        this.shakeDuration = 0;

        // Player state
        this.player = {
            health: 100,
            armor: 0,
            enemiesKilled: 0,
            totalEnemies: 0
        };

        this.particles = new Particles(this.scene);
        this.init();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    init() {
        // Fog for atmosphere
        this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.05);
        this.scene.background = new THREE.Color(0x050507);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const mainLight = new THREE.PointLight(0x00f2ff, 2, 50);
        mainLight.position.set(0, 10, 0);
        this.scene.add(mainLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        // Grid floor
        const gridGeom = new THREE.PlaneGeometry(100, 100, 50, 50);
        const gridMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.9,
            roughness: 0.1,
            wireframe: false
        });
        const floor = new THREE.Mesh(gridGeom, gridMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Add grid lines for sci-fi look
        const gridHelper = new THREE.GridHelper(100, 50, 0x00f2ff, 0x222222);
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);

        // Lights at corners
        const lightPositions = [
            [20, 5, 20], [-20, 5, 20], [20, 5, -20], [-20, 5, -20]
        ];
        lightPositions.forEach(pos => {
            const l = new THREE.PointLight(0x00f2ff, 5, 20);
            l.position.set(...pos);
            this.scene.add(l);

            // Neon mesh
            const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1, 0.1, 2),
                new THREE.MeshBasicMaterial({ color: 0x00f2ff })
            );
            mesh.position.set(pos[0], 1, pos[2]);
            this.scene.add(mesh);
        });

        this.waypoints = this.generateWaypoints();
        this.createRoom(0, 0, 50, 50);
    }

    generateWaypoints() {
        const waypoints = [];
        for (let i = 0; i < 5; i++) {
            waypoints.push(new THREE.Vector3(
                (Math.random() - 0.5) * 40,
                0,
                (Math.random() - 0.5) * 40
            ));
        }
        return waypoints;
    }

    createRoom(x, z, width, depth) {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.9,
            roughness: 0.1
        });

        // North wall
        const wallN = new THREE.Mesh(new THREE.BoxGeometry(width, 10, 1), wallMaterial);
        wallN.position.set(x, 5, z - depth / 2);
        this.scene.add(wallN);

        // South wall
        const wallS = new THREE.Mesh(new THREE.BoxGeometry(width, 10, 1), wallMaterial);
        wallS.position.set(x, 5, z + depth / 2);
        this.scene.add(wallS);

        // East wall
        const wallE = new THREE.Mesh(new THREE.BoxGeometry(1, 10, depth), wallMaterial);
        wallE.position.set(x + width / 2, 5, z);
        this.scene.add(wallE);

        // West wall
        const wallW = new THREE.Mesh(new THREE.BoxGeometry(1, 10, depth), wallMaterial);
        wallW.position.set(x - width / 2, 5, z);
        this.scene.add(wallW);

        // Ceiling
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), wallMaterial);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.y = 10;
        this.scene.add(ceil);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();

        this.update(delta);
        this.renderer.render(this.scene, this.camera);
    }

    update(delta) {
        if (this.particles) this.particles.update(delta);

        // Camera shake
        if (this.shakeDuration > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount;
            this.shakeDuration -= delta;
        } else {
            this.camera.position.x = 0;
            this.camera.position.y = 0;
        }

        // Update entities
        for (const entity of this.entities) {
            if (entity.update) entity.update(delta);
        }
    }

    addEntity(entity) {
        this.entities.push(entity);
        if (entity.mesh) this.scene.add(entity.mesh);
    }

    shake(amount, duration) {
        this.shakeAmount = amount;
        this.shakeDuration = duration;
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
            if (entity.mesh) this.scene.remove(entity.mesh);
        }
    }
}
