import { openCustomPopup, showNotification } from "../utils/UI.js";
import { t, translateDOM } from "../../core/i18n.js";
import { getSettings, saveSettings } from "../utils/storagehandler.js";

// ==========================================
// BASE PARTICLE EFFECT INTERFACE
// ==========================================
class ParticleEffect {
    constructor(canvas, ctx, config) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config;
        this.particles = [];
    }
    init() {
        this.particles = [];
    }
    update() {}
    render() {}
    resize() {}
    static getSettingsHTML() {
        return "";
    }
}

// ==========================================
// TECHNOLOGY (NODES & LINES) EFFECT
// ==========================================
class TechnologyEffect extends ParticleEffect {
    static ID = "technology";
    static DEFAULTS = {
        count: 30,
        size: 2,
        speed: 0.5,
        lineDist: 180,
        color: "#ffffff",
    };

    init() {
        super.init();
        const { width, height } = this.canvas;
        const count = this.config.count || TechnologyEffect.DEFAULTS.count;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
            });
        }
    }

    update() {
        const { width, height } = this.canvas;
        const speed = this.config.speed || TechnologyEffect.DEFAULTS.speed;
        this.particles.forEach((p) => {
            p.x += p.vx * speed;
            p.y += p.vy * speed;
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
        });
    }

    render() {
        const { ctx, particles, config } = this;
        const color = config.color || "#ffffff";
        const size = config.size || 2;
        const lineDist = config.lineDist || 100;

        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fill();

            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < lineDist) {
                    ctx.beginPath();
                    ctx.globalAlpha = 1 - dist / lineDist;
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.technology.count">Số lượng hạt</label>
                <input type="range" min="10" max="300" data-key="count" />
                <input type="number" min="10" max="300" data-key="count" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.technology.speed">Tốc độ</label>
                <input type="range" min="0.1" max="3" step="0.1" data-key="speed" />
                <input type="number" min="0.1" max="3" step="0.1" data-key="speed" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.technology.lineDist">Khoảng cách kết nối</label>
                <input type="range" min="1" max="300" step="1" data-key="lineDist" />
                <input type="number" min="1" max="300" step="1" data-key="lineDist" />
            </div>
        `;
    }
}

// ==========================================
// SNOW EFFECT
// ==========================================
class SnowEffect extends ParticleEffect {
    static ID = "snow";
    static DEFAULTS = {
        count: 150,
        speed: 1.0,
        angle: 3,
        opacity: 0.8,
        color: "#ffffff",
    };

    init() {
        super.init();
        const count = this.config.count !== undefined ? this.config.count : SnowEffect.DEFAULTS.count;
        this.time = 0;
        this.currentWind = 0;

        for (let i = 0; i < count; i++) {
            this.pushFlake(true);
        }
        // Sort to ensure foreground particles are drawn on top
        this.particles.sort((a, b) => a.z - b.z);
    }

    pushFlake(firstTime = false) {
        const { width, height } = this.canvas;

        const rand = Math.random();
        let p = {
            x: Math.random() * width,
            y: firstTime ? Math.random() * height : -100, // Snow falls down
            z: rand,
            swingSpeed: Math.random() * 0.02 + 0.005,
            swingStep: Math.random() * Math.PI * 2,
            windSensitivity: rand * 2.5 + 0.2,
        };

        if (rand > 0.97) {
            // Foreground (Cinematic blur)
            p.radius = Math.random() * 30 + 20; // 20 -> 50px for snow
            p.baseSpeed = Math.random() * 5 + 4; // fast falling
            p.baseOpacity = Math.random() * 0.2 + 0.05;
            p.isSoft = true;
        } else if (rand > 0.8) {
            // Midground
            p.radius = Math.random() * 3 + 2;
            p.baseSpeed = Math.random() * 1.5 + 1;
            p.baseOpacity = Math.random() * 0.5 + 0.2;
            p.isSoft = false;
        } else {
            // Background
            p.radius = Math.random() * 1.2 + 0.5;
            p.baseSpeed = Math.random() * 0.5 + 0.5;
            p.baseOpacity = Math.random() * 0.4 + 0.1;
            p.isSoft = false;
        }

        p.verticalSpeed = p.baseSpeed;
        this.particles.push(p);
    }

    update() {
        const { width, height } = this.canvas;
        const speedMultiplier = this.config.speed !== undefined ? this.config.speed : SnowEffect.DEFAULTS.speed;
        const targetWind = this.config.angle !== undefined ? this.config.angle / 10 : SnowEffect.DEFAULTS.angle / 10;

        this.time += 0.005;
        let naturalGust = Math.sin(this.time) * 0.1;
        this.currentWind += (targetWind + naturalGust - this.currentWind) * 0.03;

        this.particles.forEach((p) => {
            p.y += p.verticalSpeed * speedMultiplier;
            p.x += this.currentWind * p.windSensitivity;
            p.swingStep += p.swingSpeed;
            p.x += Math.cos(p.swingStep) * (p.z * 0.5);

            const limit = p.radius * 2;
            if (p.y > height + limit) {
                // Snow falls across the bottom
                p.y = -limit;
                p.x = Math.random() * width;
            }
            if (p.x > width + limit) p.x = -limit;
            else if (p.x < -limit) p.x = width + limit;
        });
    }

    render() {
        const { ctx, particles, config } = this;
        const opcMultiplier = this.config.opacity !== undefined ? this.config.opacity : SnowEffect.DEFAULTS.opacity;

        // Resolve clean RGB for gradients
        let rgb = "255, 255, 255";
        if (config.color && config.color.startsWith("#")) {
            const r = parseInt(config.color.slice(1, 3), 16);
            const g = parseInt(config.color.slice(3, 5), 16);
            const b = parseInt(config.color.slice(5, 7), 16);
            rgb = `${r}, ${g}, ${b}`;
        }

        particles.forEach((p) => {
            const alpha = Math.min(1, Math.max(0, p.baseOpacity * opcMultiplier));

            if (p.isSoft) {
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
                gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
                gradient.addColorStop(1, `rgba(${rgb}, 0)`);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.snow.count">Lượng tuyết</label>
                <input type="range" min="10" max="500" data-key="count" />
                <input type="number" min="10" max="500" data-key="count" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.snow.speed">Tốc độ rơi</label>
                <input type="range" min="0.1" max="5" step="0.1" data-key="speed" />
                <input type="number" min="0.1" max="5" step="0.1" data-key="speed" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.snow.angle">Góc độ rơi</label>
                <input type="range" min="-30" max="30" step="1" data-key="angle" />
                <input type="number" min="-30" max="30" step="1" data-key="angle" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.snow.opacity">Độ mờ</label>
                <input type="range" min="0.1" max="2" step="0.1" data-key="opacity" />
                <input type="number" min="0.1" max="2" step="0.1" data-key="opacity" />
            </div>
        `;
    }
}

// ==========================================
// DUST EFFECT
// ==========================================
class DustEffect extends ParticleEffect {
    static ID = "dust";
    static DEFAULTS = {
        count: 120,
        speed: 0.4,
        angle: 3,
        opacity: 0.8,
        color: "#dce1e6",
    };

    init() {
        super.init();
        const count = this.config.count !== undefined ? this.config.count : DustEffect.DEFAULTS.count;
        this.time = 0;
        this.currentWind = 0;

        for (let i = 0; i < count; i++) {
            this.pushFlake(true);
        }
        this.particles.sort((a, b) => a.z - b.z);
    }

    pushFlake(firstTime = false) {
        const { width, height } = this.canvas;

        const rand = Math.random();
        let p = {
            x: Math.random() * width,
            y: firstTime ? Math.random() * height : height + 100,
            z: rand,
            swingSpeed: Math.random() * 0.02 + 0.005,
            swingStep: Math.random() * Math.PI * 2,
            windSensitivity: rand * 2.5 + 0.2,
        };

        if (rand > 0.97) {
            // Foreground (Cinematic blur)
            p.radius = Math.random() * 40 + 30;
            p.baseUpward = Math.random() * 8 + 6;
            p.baseOpacity = Math.random() * 0.1 + 0.02;
            p.isSoft = true;
        } else if (rand > 0.8) {
            // Midground
            p.radius = Math.random() * 3 + 2;
            p.baseUpward = Math.random() * 1.5 + 1;
            p.baseOpacity = Math.random() * 0.3 + 0.1;
            p.isSoft = false;
        } else {
            // Background
            p.radius = Math.random() * 1.2 + 0.2;
            p.baseUpward = Math.random() * 0.5 + 0.2;
            p.baseOpacity = Math.random() * 0.4 + 0.1;
            p.isSoft = false;
        }

        p.verticalSpeed = p.baseUpward * -1;
        this.particles.push(p);
    }

    update() {
        const { width, height } = this.canvas;
        const speedMultiplier = this.config.speed !== undefined ? this.config.speed : DustEffect.DEFAULTS.speed;
        const targetWind = this.config.angle !== undefined ? this.config.angle / 10 : DustEffect.DEFAULTS.angle / 10;

        this.time += 0.005;
        let naturalGust = Math.sin(this.time) * 0.1;
        this.currentWind += (targetWind + naturalGust - this.currentWind) * 0.03;

        this.particles.forEach((p) => {
            p.y += p.verticalSpeed * speedMultiplier;
            p.x += this.currentWind * p.windSensitivity;
            p.swingStep += p.swingSpeed;
            p.x += Math.cos(p.swingStep) * (p.z * 0.5);

            const limit = p.radius * 2;
            if (p.y < -limit) {
                p.y = height + limit;
                p.x = Math.random() * width;
            }
            if (p.x > width + limit) p.x = -limit;
            else if (p.x < -limit) p.x = width + limit;
        });
    }

    render() {
        const { ctx, particles, config } = this;
        const colorBase = config.color || "220, 225, 230"; // Assuming RGB if possible, but we'll adapt
        const opcMultiplier = this.config.opacity !== undefined ? this.config.opacity : DustEffect.DEFAULTS.opacity;

        // Resolve clean RGB for gradients
        let rgb = "220, 225, 230";
        if (config.color && config.color.startsWith("#")) {
            const r = parseInt(config.color.slice(1, 3), 16);
            const g = parseInt(config.color.slice(3, 5), 16);
            const b = parseInt(config.color.slice(5, 7), 16);
            rgb = `${r}, ${g}, ${b}`;
        }

        particles.forEach((p) => {
            const alpha = Math.min(1, Math.max(0, p.baseOpacity * opcMultiplier));

            if (p.isSoft) {
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
                gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`);
                gradient.addColorStop(1, `rgba(${rgb}, 0)`);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.dust.count">Mật độ bụi</label>
                <input type="range" min="10" max="600" data-key="count" />
                <input type="number" min="10" max="600" data-key="count" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.dust.speed">Tốc độ bay</label>
                <input type="range" min="0.1" max="5" step="0.1" data-key="speed" />
                <input type="number" min="0.1" max="5" step="0.1" data-key="speed" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.dust.angle">Chiều gió</label>
                <input type="range" min="-10" max="10" step="1" data-key="angle" />
                <input type="number" min="-10" max="10" step="1" data-key="angle" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.dust.opacity">Độ mờ</label>
                <input type="range" min="0.1" max="2" step="0.1" data-key="opacity" />
                <input type="number" min="0.1" max="2" step="0.1" data-key="opacity" />
            </div>
        `;
    }
}

// ==========================================
// PETALS EFFECT
// ==========================================
class PetalsEffect extends ParticleEffect {
    static ID = "petals";
    static DEFAULTS = {
        count: 50,
        speed: 1.0,
        size: 1.0,
        angle: 5,
        opacity: 0.8,
        color: "#ffc0cb",
    };

    init() {
        super.init();
        const count = this.config.count !== undefined ? this.config.count : PetalsEffect.DEFAULTS.count;
        this.time = 0;
        this.currentWind = 0;

        for (let i = 0; i < count; i++) {
            this.pushFlake(true);
        }
        this.particles.sort((a, b) => a.z - b.z);
    }

    pushFlake(firstTime = false) {
        const { width, height } = this.canvas;
        const rand = Math.random();

        // Same layered logic as snow/dust
        let p = {
            x: Math.random() * width,
            y: firstTime ? Math.random() * height : -50,
            z: rand,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.05,
            flip: Math.random() * Math.PI * 2,
            flipSpeed: Math.random() * 0.03 + 0.01,
            swingSpeed: Math.random() * 0.02 + 0.005,
            swingStep: Math.random() * Math.PI * 2,
            windSensitivity: rand * 2.5 + 0.2,
        };

        if (rand > 0.95) {
            // Foreground
            p.radius = Math.random() * 30 + 20;
            p.baseSpeed = Math.random() * 3 + 2;
            p.baseOpacity = Math.random() * 0.2 + 0.1;
            p.isSoft = true;
        } else if (rand > 0.7) {
            // Midground
            p.radius = Math.random() * 8 + 6;
            p.baseSpeed = Math.random() * 1.5 + 0.8;
            p.baseOpacity = Math.random() * 0.5 + 0.3;
            p.isSoft = false;
        } else {
            // Background
            p.radius = Math.random() * 3 + 2;
            p.baseSpeed = Math.random() * 0.5 + 0.4;
            p.baseOpacity = Math.random() * 0.6 + 0.2;
            p.isSoft = false;
        }

        this.particles.push(p);
    }

    update() {
        const { width, height } = this.canvas;
        const speedMultiplier = this.config.speed !== undefined ? this.config.speed : PetalsEffect.DEFAULTS.speed;
        const targetWind = this.config.angle !== undefined ? this.config.angle / 10 : PetalsEffect.DEFAULTS.angle / 10;

        this.time += 0.005;
        let naturalGust = Math.sin(this.time * 0.5) * 0.2;
        this.currentWind += (targetWind + naturalGust - this.currentWind) * 0.02;

        this.particles.forEach((p) => {
            p.y += p.baseSpeed * speedMultiplier;
            p.x += this.currentWind * p.windSensitivity;
            p.swingStep += p.swingSpeed;
            p.x += Math.cos(p.swingStep) * (p.z * 1.5); // More chao đảo than snow

            p.rot += p.rotSpeed;
            p.flip += p.flipSpeed;

            const limit = p.radius * 2;
            if (p.y > height + limit) {
                p.y = -limit;
                p.x = Math.random() * width;
            }
            if (p.x > width + limit) p.x = -limit;
            else if (p.x < -limit) p.x = width + limit;
        });
    }

    render() {
        const { ctx, particles, config } = this;
        const color = config.color || "#ffc0cb";
        const opcMultiplier = this.config.opacity !== undefined ? this.config.opacity : PetalsEffect.DEFAULTS.opacity;
        const sizeMultiplier = this.config.size !== undefined ? this.config.size : PetalsEffect.DEFAULTS.size;

        let rgb = "255, 192, 203";
        if (color.startsWith("#")) {
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            rgb = `${r}, ${g}, ${b}`;
        }

        particles.forEach((p) => {
            const alpha = Math.min(1, Math.max(0, p.baseOpacity * opcMultiplier));
            const flipScale = Math.cos(p.flip); // 3D scale simulation
            const currentRadius = p.radius * sizeMultiplier;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.scale(1, flipScale); // Flip on one axis

            if (p.isSoft) {
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentRadius);
                grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
                grad.addColorStop(1, `rgba(${rgb}, 0)`);
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
            }

            // Draw a basic petal shape (leaf-like)
            ctx.beginPath();
            ctx.moveTo(0, -currentRadius);
            ctx.quadraticCurveTo(currentRadius * 0.8, -currentRadius * 0.5, 0, currentRadius);
            ctx.quadraticCurveTo(-currentRadius * 0.8, -currentRadius * 0.5, 0, -currentRadius);
            ctx.fill();

            // Add a subtle line in middle
            if (!p.isSoft && currentRadius > 5) {
                ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.5})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, -currentRadius);
                ctx.lineTo(0, currentRadius);
                ctx.stroke();
            }

            ctx.restore();
        });
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.petals.count">Lượng cánh hoa</label>
                <input type="range" min="10" max="300" data-key="count" />
                <input type="number" min="10" max="300" data-key="count" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.petals.speed">Tốc độ rơi</label>
                <input type="range" min="0.1" max="5" step="0.1" data-key="speed" />
                <input type="number" min="0.1" max="5" step="0.1" data-key="speed" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.petals.size">Kích thước</label>
                <input type="range" min="0.1" max="3" step="0.1" data-key="size" />
                <input type="number" min="0.1" max="3" step="0.1" data-key="size" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.petals.angle">Hướng gió</label>
                <input type="range" min="-30" max="30" step="1" data-key="angle" />
                <input type="number" min="-30" max="30" step="1" data-key="angle" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.petals.opacity">Độ mờ</label>
                <input type="range" min="0.1" max="2" step="0.1" data-key="opacity" />
                <input type="number" min="0.1" max="2" step="0.1" data-key="opacity" />
            </div>
        `;
    }
}

// ==========================================
// FIREFLIES EFFECT
// ==========================================
class FirefliesEffect extends ParticleEffect {
    static ID = "fireflies";
    static DEFAULTS = {
        count: 20,
        speed: 0.8,
        size: 0.8,
        opacity: 0.6,
        showDots: false,
    };

    init() {
        super.init();
        const count = this.config.count || FirefliesEffect.DEFAULTS.count;

        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle(true));
        }
        this.particles.sort((a, b) => a.z - b.z);
    }

    createParticle(firstTime = false) {
        const { width, height } = this.canvas;
        const rand = Math.random();
        let p = {
            x: Math.random() * width,
            y: firstTime ? Math.random() * height : height + 100,
            z: rand,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            alpha: Math.random(),
            pulseSpeed: Math.random() * 0.02 + 0.005,
            angle: Math.random() * Math.PI * 2,
            angleSpeed: (Math.random() - 0.5) * 0.01,
        };

        if (rand > 0.95) {
            // Foreground (Cinematic)
            p.radius = Math.random() * 40 + 30;
            p.depthMult = 1.5;
            p.baseOpacity = 0.03;
            p.isSoft = true;
        } else if (rand > 0.7) {
            // Midground
            p.radius = Math.random() * 5 + 3;
            p.depthMult = 1.0;
            p.baseOpacity = 0.3;
            p.isSoft = false;
        } else {
            // Background
            p.radius = Math.random() * 1.5 + 0.5;
            p.depthMult = 0.5;
            p.baseOpacity = 0.6;
            p.isSoft = false;
        }

        return p;
    }

    update() {
        const { width, height } = this.canvas;
        const speedMultiplier = this.config.speed || FirefliesEffect.DEFAULTS.speed;

        this.particles.forEach((p) => {
            p.angle += p.angleSpeed * speedMultiplier;
            // Move generally upward like dust, but with organic sway
            p.x += (p.vx + Math.cos(p.angle) * 0.2) * speedMultiplier * p.depthMult;
            p.y += (p.vy - 0.2 + Math.sin(p.angle) * 0.2) * speedMultiplier * p.depthMult;

            p.alpha += p.pulseSpeed * speedMultiplier;
            if (p.alpha > 1 || p.alpha < 0) p.pulseSpeed *= -1;

            const limit = p.radius * 2 + 100;
            if (p.y < -limit) p.y = height + limit;
            if (p.y > height + limit) p.y = -limit;
            if (p.x < -limit) p.x = width + limit;
            if (p.x > width + limit) p.x = -limit;
        });
    }

    render() {
        const { ctx, particles, config } = this;
        const sizeMult = config.size || 0.8;
        const opcMult = config.opacity || 0.6;
        const showDots = config.showDots !== undefined ? config.showDots : false;

        particles.forEach((p) => {
            const currentAlpha = Math.max(0, p.alpha * p.baseOpacity * opcMult * 2);
            const r = p.radius * sizeMult;

            if (p.isSoft) {
                // Foreground blur
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha})`);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${currentAlpha * 0.2})`);
                gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Mid/Background soft glow
                const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
                gradient.addColorStop(0, `rgba(255, 255, 255, ${currentAlpha})`);
                gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
                ctx.fill();

                if (showDots && p.z < 0.9) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 0.8})`;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.fireflies.count">Số lượng</label>
                <input type="range" min="10" max="100" data-key="count" />
                <input type="number" min="10" max="100" data-key="count" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.fireflies.speed">Tốc độ bay</label>
                <input type="range" min="0.1" max="2" step="0.1" data-key="speed" />
                <input type="number" min="0.1" max="2" step="0.1" data-key="speed" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.fireflies.size">Kích thước</label>
                <input type="range" min="0.1" max="2" step="0.1" data-key="size" />
                <input type="number" min="0.1" max="2" step="0.1" data-key="size" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.fireflies.opacity">Độ rực rỡ</label>
                <input type="range" min="0.1" max="1" step="0.1" data-key="opacity" />
                <input type="number" min="0.1" max="1" step="0.1" data-key="opacity" />
            </div>
        `;
    }
}

// ==========================================
// TV NOISE EFFECT
// ==========================================
class NoiseEffect extends ParticleEffect {
    static ID = "noise";
    static DEFAULTS = {
        opacity: 0.1,
        brightness: 0.5,
    };

    init() {
        super.init();
        this.noiseCanvases = [];
        this.frameCount = 0;

        // Pre-render 3 frames of noise for high performance
        for (let i = 0; i < 3; i++) {
            const nc = document.createElement("canvas");
            nc.width = 256;
            nc.height = 256;
            const nctx = nc.getContext("2d");
            const imgData = nctx.createImageData(256, 256);
            const data = imgData.data;
            for (let j = 0; j < data.length; j += 4) {
                const val = Math.random() * 255;
                data[j] = val;
                data[j + 1] = val;
                data[j + 2] = val;
                data[j + 3] = 255;
            }
            nctx.putImageData(imgData, 0, 0);
            this.noiseCanvases.push(nc);
        }
    }

    update() {
        this.frameCount++;
    }

    render() {
        const { ctx, canvas, config } = this;
        const opacity = config.opacity !== undefined ? config.opacity : NoiseEffect.DEFAULTS.opacity;
        const brightness = config.brightness !== undefined ? config.brightness : NoiseEffect.DEFAULTS.brightness;

        ctx.save();
        ctx.globalAlpha = opacity;

        // Cycle through noise frames
        const frame = this.noiseCanvases[this.frameCount % 3];
        const pattern = ctx.createPattern(frame, "repeat");
        ctx.fillStyle = pattern;

        // Shift pattern randomly for organic flickering
        const offsetX = Math.floor(Math.random() * 256);
        const offsetY = Math.floor(Math.random() * 256);
        ctx.translate(offsetX, offsetY);

        // Fill with brightness adjustment via globalCompositeOperation if needed,
        // but simple globalAlpha is usually best for static
        ctx.fillRect(-offsetX, -offsetY, canvas.width, canvas.height);

        // Subtle horizontal scanline simulation
        if (Math.random() > 0.5) {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.2})`;
            ctx.fillRect(-offsetX, Math.random() * canvas.height - offsetY, canvas.width, 2);
        }

        ctx.restore();
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.noise.opacity">Cường độ nhiễu</label>
                <input type="range" min="0" max="0.4" step="0.01" data-key="opacity" />
                <input type="number" min="0" max="0.4" step="0.01" data-key="opacity" />
            </div>
        `;
    }
}

// ==========================================
// VIGNETTE EFFECT
// ==========================================
class VignetteEffect extends ParticleEffect {
    static ID = "vignette";
    static DEFAULTS = {
        opacity: 0.5,
        size: 0.7,
    };

    render() {
        const { ctx, canvas, config } = this;
        const opacity = config.opacity !== undefined ? config.opacity : VignetteEffect.DEFAULTS.opacity;
        const size = config.size !== undefined ? config.size : VignetteEffect.DEFAULTS.size;

        ctx.save();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.sqrt(centerX ** 2 + centerY ** 2);

        const gradient = ctx.createRadialGradient(centerX, centerY, radius * (1 - size), centerX, centerY, radius);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
        gradient.addColorStop(1, `rgba(0, 0, 0, ${opacity})`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.vignette.opacity">Độ đậm</label>
                <input type="range" min="0" max="1" step="0.05" data-key="opacity" />
                <input type="number" min="0" max="1" step="0.05" data-key="opacity" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.vignette.size">Kích thước vùng tối</label>
                <input type="range" min="0.1" max="1" step="0.05" data-key="size" />
                <input type="number" min="0.1" max="1" step="0.05" data-key="size" />
            </div>
        `;
    }
}

// ==========================================
// MAIN CONTROLLER
// ==========================================
class ParticlesController {
    constructor() {
        this.container = document.querySelector(".particle_container");
        if (!this.container) return;
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.registry = {
            [TechnologyEffect.ID]: TechnologyEffect,
            [SnowEffect.ID]: SnowEffect,
            [DustEffect.ID]: DustEffect,
            [PetalsEffect.ID]: PetalsEffect,
            [FirefliesEffect.ID]: FirefliesEffect,
            [NoiseEffect.ID]: NoiseEffect,
            [VignetteEffect.ID]: VignetteEffect,
        };
        this.currentEffect = null;
        this.animationId = null;

        this.initCanvas();
        window.addEventListener("resize", () => this.resize());
    }

    initCanvas() {
        Object.assign(this.canvas.style, {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
        });
        this.container.appendChild(this.canvas);
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.currentEffect) this.currentEffect.init();
    }

    start(type, config) {
        this.stop();
        const EffectClass = this.registry[type] || TechnologyEffect;
        const mergedConfig = { ...EffectClass.DEFAULTS, ...(config || {}) };
        this.currentEffect = new EffectClass(this.canvas, this.ctx, mergedConfig);
        this.currentEffect.init();
        this.loop();
    }

    loop() {
        if (!this.currentEffect) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentEffect.update();
        this.currentEffect.render();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    stop() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentEffect = null;
    }
}

class ParticlesSettingsEditor {
    constructor(controller) {
        this.controller = controller;
        this.handlePresetChange = this.handlePresetChange.bind(this);
        this.handleBeforeClose = this.handleBeforeClose.bind(this);
        this.handleReset = this.handleReset.bind(this);
        this.isDirty = false;
        this.isSaved = false;
        this.canExit = false;
        this.exitTimer = null;
        this.initialData = null;
        this.previewTimer = null;
    }

    initialize() {
        const toggle = document.getElementById("particles_animation");
        if (!toggle) return;

        const data = getSettings().particles || { enabled: false, preset: "technology", config: {} };
        toggle.checked = data.enabled;
        if (data.enabled) {
            this.controller.start(data.preset, data.config);
        }

        toggle.addEventListener("change", (e) => {
            const isEnabled = e.target.checked;
            let current = getSettings().particles;
            current.enabled = isEnabled;
            if (isEnabled) this.controller.start(current.preset, current.config);
            else this.controller.stop();
            saveSettings({ particles: current });
        });

        const editBtn = document.getElementById("edit_particles_settings");
        if (editBtn) editBtn.addEventListener("mousedown", () => this.openEditor());
    }

    openEditor() {
        const template = document.getElementById("tpl_particles_settings");
        if (!template) return;
        this.clone = template.content.cloneNode(true);
        translateDOM(this.clone);

        this.btnSave = this.clone.querySelector("#btn_save");
        this.btnPreview = this.clone.querySelector("#btn_preview");
        this.btnReset = this.clone.querySelector("#btn_reset");
        this.customContainer = this.clone.querySelector("#particle_custom_container");

        this.initialData = JSON.parse(JSON.stringify(getSettings().particles));
        this.isSaved = false;
        this.isDirty = false;

        document.addEventListener("subsectionChange", this.handlePresetChange);
        this.btnSave.onmousedown = () => this.handleSave();
        if (this.btnPreview) this.btnPreview.onmousedown = () => this.handlePreview();
        if (this.btnReset) this.btnReset.onmousedown = () => this.handleReset();

        openCustomPopup(t("setting_panel.wallpaper_customization.particles_settings"), this.clone, "420px", true, true);

        const closeBtn = document.querySelector(".popup_close");
        if (closeBtn) closeBtn.addEventListener("popupBeforeClose", this.handleBeforeClose);

        import("../utils/UI.js").then(({ initSvgs }) => initSvgs());

        const data = this.initialData;
        setTimeout(() => {
            const mockEvent = new CustomEvent("subsectionChange", {
                bubbles: true,
                detail: { id: "particles_preset", value: data.preset || "technology", firstRun: true },
            });
            document.dispatchEvent(mockEvent);
        }, 50);
    }

    handlePresetChange(e) {
        if (e.detail.id !== "particles_preset") return;
        const type = e.detail.value;
        const effectClass = this.controller.registry[type];
        if (!effectClass) return;

        this.customContainer.innerHTML = effectClass.getSettingsHTML();
        translateDOM(this.customContainer);

        const data = getSettings().particles;
        let currentConfig = data.preset === type ? data.config || {} : effectClass.DEFAULTS;
        currentConfig = { ...effectClass.DEFAULTS, ...currentConfig };

        this.syncConfigToUI(currentConfig);
        this.controller.start(type, currentConfig);

        if (!e.detail.firstRun) {
            this.isDirty = true;
            this.handlePreview();
        }
    }

    syncConfigToUI(config) {
        const inputs = this.customContainer.querySelectorAll("input");
        inputs.forEach((input) => {
            const key = input.dataset.key;
            if (config[key] !== undefined) {
                if (input.type === "checkbox") {
                    input.checked = config[key];
                    input.onchange = () => {
                        this.isDirty = true;
                        this.handlePreview();
                    };
                } else {
                    input.value = config[key];

                    const updateValue = (newVal, skipUI = false) => {
                        this.isDirty = true;
                        const min = parseFloat(input.min);
                        const max = parseFloat(input.max);
                        let clampedVal = parseFloat(newVal);

                        if (!isNaN(min)) clampedVal = Math.max(min, clampedVal);
                        if (!isNaN(max)) clampedVal = Math.min(max, clampedVal);
                        if (isNaN(clampedVal)) clampedVal = config[key] || min || 0;

                        const siblings = this.customContainer.querySelectorAll(`input[data-key="${key}"]`);
                        siblings.forEach((s) => {
                            if (s.type === "range") s.value = clampedVal;
                            else if (!skipUI) s.value = clampedVal;
                        });
                        this.handlePreview();
                    };

                    input.oninput = () => {
                        // Slider updates everything immediately including number inputs
                        if (input.type === "range") {
                            updateValue(input.value, false);
                        }
                    };

                    input.onchange = () => {
                        updateValue(input.value);
                    };
                }
            }
        });
    }

    handleReset() {
        const btnPreset = document.getElementById("particles_preset");
        const type = btnPreset ? btnPreset.getAttribute("data-selected") : "technology";
        const effectClass = this.controller.registry[type];
        if (!effectClass) return;

        this.syncConfigToUI(effectClass.DEFAULTS);
        this.isDirty = true;
        this.handlePreview();
        showNotification(t("particles_animation.reset_success"), "success");
    }

    getCurrentConfig() {
        const btnPreset = document.getElementById("particles_preset");
        const type = btnPreset ? btnPreset.getAttribute("data-selected") : "technology";
        const inputs = this.customContainer.querySelectorAll("input");
        const config = {};

        inputs.forEach((input) => {
            if (input.dataset.key) {
                let val = input.type === "checkbox" ? input.checked : parseFloat(input.value);
                if (input.type === "number" || input.type === "range") {
                    const min = parseFloat(input.min);
                    const max = parseFloat(input.max);
                    if (!isNaN(min)) val = Math.max(min, val);
                    if (!isNaN(max)) val = Math.min(max, val);
                }
                config[input.dataset.key] = val;
            }
        });

        const effectClass = this.controller.registry[type];
        if (config.color === undefined) {
            config.color = effectClass ? effectClass.DEFAULTS.color : "#ffffff";
        }

        return { type, config };
    }

    handlePreview() {
        if (this.previewTimer) clearTimeout(this.previewTimer);
        this.previewTimer = setTimeout(() => {
            const { type, config } = this.getCurrentConfig();
            this.controller.start(type, config);
        }, 16); // Faster response (~60fps debounce)
    }

    handleSave() {
        const { type, config } = this.getCurrentConfig();
        const current = getSettings().particles;
        current.preset = type;
        current.config = config;

        saveSettings({ particles: current });
        if (current.enabled) this.controller.start(type, config);
        else this.controller.stop();

        showNotification(t("alert.saved_changes"), "success");
        this.isSaved = true;
        this.isDirty = false;
        const close = document.querySelector(".popup_close");
        if (close) close.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }

    handleBeforeClose(e) {
        if (this.isDirty && !this.canExit) {
            e.preventDefault();
            showNotification(t("alert.unsaved_changes"), "warning");
            this.canExit = true;
            if (this.exitTimer) clearTimeout(this.exitTimer);
            this.exitTimer = setTimeout(() => (this.canExit = false), 5000);
        } else {
            document.removeEventListener("subsectionChange", this.handlePresetChange);
            const closeBtn = document.querySelector(".popup_close");
            if (closeBtn) closeBtn.removeEventListener("popupBeforeClose", this.handleBeforeClose);

            if (!this.isSaved) {
                const data = this.initialData;
                if (data.enabled) this.controller.start(data.preset, data.config);
                else this.controller.stop();
            }
        }
    }
}

const controller = new ParticlesController();
const editor = new ParticlesSettingsEditor(controller);
export function initializeParticles() {
    editor.initialize();
}
