export class Minimap {
    constructor(game, options = {}) {
        this.game = game;
        this.size = options.size || 220;
        this.margin = options.margin || 25;
        this.scale = options.scale || 2.5; // Adjusted scale for larger view

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'minimap';
        this.canvas.width = this.size;
        this.canvas.height = this.size;

        // Style the canvas to be at top-right
        Object.assign(this.canvas.style, {
            position: 'fixed',
            top: `${this.margin}px`,
            right: `${this.margin}px`,
            bottom: 'auto',
            left: 'auto',
            width: `${this.size}px`,
            height: `${this.size}px`,
            background: 'rgba(0, 5, 15, 0.7)',
            border: '2px solid rgba(0, 242, 255, 0.3)',
            borderRadius: '10px',
            boxShadow: '0 0 15px rgba(0, 242, 255, 0.2)',
            zIndex: '10',
            backdropFilter: 'blur(5px)'
        });

        document.getElementById('app').appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }

    update() {
        if (!this.game.controls) return;

        const playerPos = this.game.controls.getPosition();
        if (!playerPos) return;

        this.ctx.clearRect(0, 0, this.size, this.size);

        // Draw grid/background
        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.1)';
        this.ctx.beginPath();
        for (let i = 0; i <= this.size; i += 20) {
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.size);
            this.ctx.moveTo(0, i);
            this.ctx.lineTo(this.size, i);
        }
        this.ctx.stroke();

        const centerX = this.size / 2;
        const centerY = this.size / 2;

        // Draw Map Boundaries (Ship Walls)
        // Main room is 40x40, so -20 to 20
        const boundarySize = 40 * this.scale;
        this.ctx.strokeStyle = 'rgba(0, 242, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            centerX - (playerPos.x * this.scale) - (boundarySize / 2),
            centerY - (playerPos.z * this.scale) - (boundarySize / 2),
            boundarySize,
            boundarySize
        );

        // Entities - Relative to player
        // 1. Pickups
        this.game.pickups.forEach(p => {
            if (p.isDead) return;
            const dx = (p.mesh.position.x - playerPos.x) * this.scale;
            const dz = (p.mesh.position.z - playerPos.z) * this.scale;

            const x = centerX + dx;
            const y = centerY + dz;

            if (this._isInBounds(x, y)) {
                let color = '#ffffff';
                if (p.type === 'medkit') color = '#00ff66'; // Green: Life
                else if (p.type === 'armor') color = '#ffa500'; // Orange: Armor
                else if (['pistol', 'rifle', 'cannon'].includes(p.type)) color = '#00f2ff'; // Blue: Ammo

                this._drawPoint(x, y, color, 3);
            }
        });

        // 2. Enemies
        this.game.enemies.forEach(e => {
            if (e.isDead) return;
            const dx = (e.mesh.position.x - playerPos.x) * this.scale;
            const dz = (e.mesh.position.z - playerPos.z) * this.scale;

            const x = centerX + dx;
            const y = centerY + dz;

            if (this._isInBounds(x, y)) {
                this._drawPoint(x, y, '#ff0000', 4); // Red: Enemies
            }
        });

        // 3. Player (center)
        this._drawPlayer(centerX, centerY);
    }

    _isInBounds(x, y) {
        return x >= 0 && x <= this.size && y >= 0 && y <= this.size;
    }

    _drawPoint(x, y, color, radius) {
        this.ctx.fillStyle = color;
        this.ctx.shadowBlur = 5;
        this.ctx.shadowColor = color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    _drawPlayer(x, y) {
        const angle = this.game.controls.yaw.rotation.y;

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(-angle); // Flipped to point the other way

        // Player icon (triangle)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = '#ffffff';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -6);
        this.ctx.lineTo(4, 4);
        this.ctx.lineTo(-4, 4);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }
}
