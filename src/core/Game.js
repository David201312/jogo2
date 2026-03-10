import * as THREE from 'three';

export class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.envGroup = new THREE.Group();
        this.scene.add(this.envGroup);
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1); // Performance boost on high-DPI screens
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap; // Faster shadow type
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        document.getElementById('app').prepend(this.renderer.domElement);

        this.lastTime = performance.now();
        this.shakeAmount = 0;
        this.shakeDuration = 0;

        // Player state
        this.player = {
            health: 100,
            armor: 0,
            score: 0,
            enemiesKilled: 0,
            totalEnemies: 0,
            ammo: {
                pistol: 20,
                rifle: 0,
                cannon: 0,
                super_machine_gun: 0
            }
        };

        this.isBossFight = false;
        this.isInfiniteWaves = false;

        this.collidables = []; // New: Objects for scenery collision
        this.buildEnvironment();
        this._startLoop();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    clearEnvironment() {
        // Remove all children from envGroup
        while (this.envGroup.children.length > 0) {
            this.envGroup.remove(this.envGroup.children[0]);
        }
        this.collidables = [];
        this.waypoints = [];
    }

    buildEnvironment() {
        // Fog — light density so scene is visible
        this.scene.fog = new THREE.FogExp2(0x050510, 0.018);
        this.scene.background = new THREE.Color(0x050510);

        // ----- Lights -----
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0x00aaff, 0x111111, 0.5);
        this.scene.add(hemi);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 15, 10);
        this.envGroup.add(dirLight);

        // ----- Floor -----
        const floorGeom = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x181820,
            metalness: 0.7,
            roughness: 0.3
        });
        const floor = new THREE.Mesh(floorGeom, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.envGroup.add(floor);

        // Grid helper for sci-fi look
        const grid = new THREE.GridHelper(100, 60, 0x00f2ff, 0x1a1a2e);
        grid.position.y = 0.02;
        grid.material.opacity = 0.4;
        grid.material.transparent = true;
        this.envGroup.add(grid);

        // ----- Spaceship Layout (multi-room) -----
        this.buildSpaceship();

        // ----- Neon pillars at corners -----
        const cornerPositions = [
            [18, 18], [-18, 18], [18, -18], [-18, -18],
            [0, 20], [0, -20], [20, 0], [-20, 0]
        ];
        cornerPositions.forEach(([px, pz]) => {
            // Pillar
            const pillarGeom = new THREE.CylinderGeometry(0.15, 0.15, 8, 8);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.9, roughness: 0.1 });
            const pillar = new THREE.Mesh(pillarGeom, pillarMat);
            pillar.position.set(px, 4, pz);
            this.envGroup.add(pillar);

            // Neon strip on pillar
            const stripGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8);
            const stripMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
            const strip = new THREE.Mesh(stripGeom, stripMat);
            strip.position.set(px, 2, pz);
            this.envGroup.add(strip);

            // Static point lights on pillars removed for performance
            // const pl = new THREE.PointLight(0x00f2ff, 3, 15);
            // pl.position.set(px, 3, pz);
            // this.scene.add(pl);
        });

        // ----- Floating dust particles -----
        const particleCount = 250; // Reduced for performance
        const particleGeom = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 50;
            positions[i + 1] = Math.random() * 9;
            positions[i + 2] = (Math.random() - 0.5) * 50;
        }
        particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0x00f2ff,
            size: 0.08,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.dustParticles = new THREE.Points(particleGeom, particleMat);
        this.envGroup.add(this.dustParticles);

        // ----- Waypoints for item spawns -----
        this.waypoints = [];
        for (let i = 0; i < 8; i++) {
            this.waypoints.push(new THREE.Vector3(
                (Math.random() - 0.5) * 36,
                0,
                (Math.random() - 0.5) * 36
            ));
        }
    }

    buildSpaceship() {
        // Main Command Deck (Bridge)
        this.createRoom(0, 0, 40, 40);

        // Captain's Platform (elevated area)
        const platformGeom = new THREE.BoxGeometry(10, 0.8, 10);
        const platformMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.9, roughness: 0.1 });
        const platform = new THREE.Mesh(platformGeom, platformMat);
        platform.position.set(0, 0.4, -2);
        this.envGroup.add(platform);

        // Holographic Globe / Command Table
        const tableGeom = new THREE.CylinderGeometry(1.5, 1.2, 1, 16);
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1 });
        const table = new THREE.Mesh(tableGeom, tableMat);
        table.position.set(0, 1.2, -2);
        this.envGroup.add(table);
        this.collidables.push(table); // Command table is solid

        const holoGeom = new THREE.SphereGeometry(1.2, 16, 16);
        const holoMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, wireframe: true, transparent: true, opacity: 0.4 });
        const holo = new THREE.Mesh(holoGeom, holoMat);
        holo.position.set(0, 2.5, -2);
        this.envGroup.add(holo);

        // Command Consoles
        const consoleMat = new THREE.MeshStandardMaterial({ color: 0x333344, emissive: 0x00f2ff, emissiveIntensity: 0.2 });
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 16;
            const cPos = new THREE.Vector3(Math.cos(angle) * dist, 0.6, Math.sin(angle) * dist);
            const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 1.5), consoleMat);
            consoleBox.position.copy(cPos);
            consoleBox.lookAt(0, 0.6, 0);
            this.envGroup.add(consoleBox);
            this.collidables.push(consoleBox); // Consoles are solid
        }

        // front Viewport (Large window)
        const windowGlow = new THREE.Mesh(
            new THREE.PlaneGeometry(30, 8),
            new THREE.MeshBasicMaterial({ color: 0x001133, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
        );
        windowGlow.position.set(0, 5, -19.5);
        this.envGroup.add(windowGlow);

        // Update waypoints
        this.waypoints = [
            new THREE.Vector3(15, 0, 15),
            new THREE.Vector3(-15, 0, 15),
            new THREE.Vector3(15, 0, -15),
            new THREE.Vector3(-15, 0, -15),
            new THREE.Vector3(0, 1.5, -2)
        ];
    }

    createRoom(x, z, width, depth) {
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x222233,
            metalness: 0.8,
            roughness: 0.2
        });

        const wallHeight = 10;
        const wallThickness = 0.8;

        // North
        const wallN = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, wallThickness), wallMat);
        wallN.position.set(x, wallHeight / 2, z - depth / 2);
        this.envGroup.add(wallN);
        this.collidables.push(wallN);

        // South
        const wallS = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, wallThickness), wallMat);
        wallS.position.set(x, wallHeight / 2, z + depth / 2);
        this.envGroup.add(wallS);
        this.collidables.push(wallS);

        // East
        const wallE = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, depth), wallMat);
        wallE.position.set(x + width / 2, wallHeight / 2, z);
        this.envGroup.add(wallE);
        this.collidables.push(wallE);

        // West
        const wallW = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, depth), wallMat);
        wallW.position.set(x - width / 2, wallHeight / 2, z);
        this.envGroup.add(wallW);
        this.collidables.push(wallW);

        // Ceiling
        const ceilMat = new THREE.MeshStandardMaterial({ color: 0x151520, metalness: 0.6, roughness: 0.4 });
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(x, wallHeight, z);
        this.envGroup.add(ceil);

        // Neon line along ceiling border
        const neonMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
        [
            [x, wallHeight - 0.1, z - depth / 2 + 0.5, width, 0.05, 0.05],
            [x, wallHeight - 0.1, z + depth / 2 - 0.5, width, 0.05, 0.05],
            [x + width / 2 - 0.5, wallHeight - 0.1, z, 0.05, 0.05, depth],
            [x - width / 2 + 0.5, wallHeight - 0.1, z, 0.05, 0.05, depth]
        ].forEach(([px, py, pz, w, h, d]) => {
            const neon = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), neonMat);
            neon.position.set(px, py, pz);
            this.envGroup.add(neon);
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _startLoop() {
        this.lastTime = performance.now();
        const loop = () => {
            const now = performance.now();
            const delta = Math.min((now - this.lastTime) / 1000, 0.05); // cap delta
            this.lastTime = now;

            this.update(delta);
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update(delta) {
        // Dust particle animation
        if (this.dustParticles) {
            this.dustParticles.rotation.y += delta * 0.03;
        }

        // Camera shake - try to use dedicated group if controls exist
        const shakeTarget = (this.controls && this.controls.shakeGroup) ? this.controls.shakeGroup : this.camera;

        if (this.shakeDuration > 0) {
            shakeTarget.position.x = (Math.random() - 0.5) * this.shakeAmount;
            shakeTarget.position.y = (Math.random() - 0.5) * this.shakeAmount;
            this.shakeDuration -= delta;
        } else if (shakeTarget.position.x !== 0 || shakeTarget.position.y !== 0) {
            shakeTarget.position.x = 0;
            shakeTarget.position.y = 0;
        }
    }

    shake(amount, duration) {
        this.shakeAmount = amount;
        this.shakeDuration = duration;
    }
}
