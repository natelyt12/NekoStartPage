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
    update() { }
    render() { }
    resize() { }
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
// CINEMATIC FRAME EFFECT
// ==========================================
class CinematicEffect extends ParticleEffect {
    static ID = "cinematic";
    static DEFAULTS = {
        thickness: 10,
        opacity: 1.0,
    };

    render() {
        const { ctx, canvas, config } = this;
        const thickness = config.thickness !== undefined ? config.thickness : CinematicEffect.DEFAULTS.thickness;
        const opacity = config.opacity !== undefined ? config.opacity : CinematicEffect.DEFAULTS.opacity;

        const barHeight = (canvas.height * (thickness / 100));

        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;

        // Top bar
        ctx.fillRect(0, 0, canvas.width, barHeight);
        // Bottom bar
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        ctx.restore();
    }

    static getSettingsHTML() {
        return `
            <div class="particles_control_group">
                <label data-i18n="particles_animation.cinematic.thickness">Độ dày thanh đen</label>
                <input type="range" min="0" max="30" step="0.5" data-key="thickness" />
                <input type="number" min="0" max="30" step="0.5" data-key="thickness" />
            </div>
            <div class="particles_control_group">
                <label data-i18n="particles_animation.cinematic.opacity">Độ mờ</label>
                <input type="range" min="0" max="1" step="0.05" data-key="opacity" />
                <input type="number" min="0" max="1" step="0.05" data-key="opacity" />
            </div>
        `;
    }
}


// ==========================================
// EFFECT REGISTRIES
// ==========================================
const DYNAMIC_EFFECTS = {
    [TechnologyEffect.ID]: TechnologyEffect,
    [SnowEffect.ID]: SnowEffect,
    [DustEffect.ID]: DustEffect,
    [PetalsEffect.ID]: PetalsEffect,
    [FirefliesEffect.ID]: FirefliesEffect,
};

const STATIC_EFFECTS = {
    [NoiseEffect.ID]: NoiseEffect,
    [VignetteEffect.ID]: VignetteEffect,
    [CinematicEffect.ID]: CinematicEffect,
};

const ALL_EFFECTS = { ...DYNAMIC_EFFECTS, ...STATIC_EFFECTS };

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ==========================================
// EFFECTS ENGINE — Multi-canvas, 2-layer
// ==========================================
class EffectsEngine {
    static MAX_PER_LAYER = 5;

    constructor() {
        this.dynamicContainer = document.querySelector(".wallpaper_effect_container");
        this.staticContainer = document.querySelector(".static_effect_container");
        this.dynamicLayers = new Map(); // id -> CanvasEntry
        this.staticLayers = new Map();
        window.addEventListener("resize", () => this.resize());
    }

    _createCanvas(container) {
        const canvas = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        Object.assign(canvas.style, {
            position: "absolute",
            top: "0", left: "0",
            width: "100%", height: "100%",
            pointerEvents: "none",
        });
        container.appendChild(canvas);
        return canvas;
    }

    _getLayerMap(layer) {
        return layer === "static" ? this.staticLayers : this.dynamicLayers;
    }

    _getContainer(layer) {
        return layer === "static" ? this.staticContainer : this.dynamicContainer;
    }

    _startLoop(id, layer) {
        const layers = this._getLayerMap(layer);
        const entry = layers.get(id);
        if (!entry) return;

        let active = true;
        entry.stop = () => { active = false; };

        const tick = () => {
            if (!active || !layers.has(id)) return;
            const e = layers.get(id);
            e.ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
            if (e.effect.update) e.effect.update();
            e.effect.render();
            e.animId = requestAnimationFrame(tick);
        };
        entry.animId = requestAnimationFrame(tick);
    }

    addEffect(id, layer, type, config) {
        const layers = this._getLayerMap(layer);
        if (layers.size >= EffectsEngine.MAX_PER_LAYER) return false;
        if (layers.has(id)) return false;

        const EffectClass = ALL_EFFECTS[type];
        if (!EffectClass) return false;

        const container = this._getContainer(layer);
        if (!container) return false;

        const canvas = this._createCanvas(container);
        const ctx = canvas.getContext("2d");
        const mergedCfg = { ...(EffectClass.DEFAULTS || {}), ...(config || {}) };
        const effect = new EffectClass(canvas, ctx, mergedCfg);
        effect.init();

        layers.set(id, { canvas, ctx, effect, animId: null, stop: null, type, config: mergedCfg });
        this._startLoop(id, layer);
        this._updateZIndices(layer);
        return true;
    }

    removeEffect(id, layer) {
        const layers = this._getLayerMap(layer);
        const entry = layers.get(id);
        if (!entry) return;
        entry.stop?.();
        cancelAnimationFrame(entry.animId);
        entry.canvas.remove();
        layers.delete(id);
        this._updateZIndices(layer);
    }

    updateEffectConfig(id, layer, config) {
        const layers = this._getLayerMap(layer);
        const entry = layers.get(id);
        if (!entry) return;
        entry.config = { ...entry.config, ...config };
        entry.effect.config = entry.config;

        // If 'count' (density) changed, re-initialize the effect to update particle array
        if (config.count !== undefined) {
            entry.effect.init();
        }
    }

    reorderEffect(id, layer, direction) {
        const layers = this._getLayerMap(layer);
        const keys = [...layers.keys()];
        const idx = keys.indexOf(id);
        if (idx < 0) return;

        if (direction === "up" && idx > 0) {
            [keys[idx - 1], keys[idx]] = [keys[idx], keys[idx - 1]];
        } else if (direction === "down" && idx < keys.length - 1) {
            [keys[idx], keys[idx + 1]] = [keys[idx + 1], keys[idx]];
        } else {
            return;
        }

        const newMap = new Map(keys.map(k => [k, layers.get(k)]));
        if (layer === "static") this.staticLayers = newMap;
        else this.dynamicLayers = newMap;
        this._updateZIndices(layer);
    }

    _updateZIndices(layer) {
        const layers = this._getLayerMap(layer);
        let z = layers.size;
        for (const [, entry] of layers) {
            entry.canvas.style.zIndex = z--;
        }
    }

    resize() {
        const resizeLayer = (map) => {
            for (const [, entry] of map) {
                entry.canvas.width = window.innerWidth;
                entry.canvas.height = window.innerHeight;
                entry.effect.init?.();
            }
        };
        resizeLayer(this.dynamicLayers);
        resizeLayer(this.staticLayers);
    }

    stopAll() {
        const clearLayer = (map) => {
            for (const [, entry] of map) {
                entry.stop?.();
                cancelAnimationFrame(entry.animId);
                entry.canvas.remove();
            }
            map.clear();
        };
        clearLayer(this.dynamicLayers);
        clearLayer(this.staticLayers);
    }

    loadState(data, enabled) {
        this.stopAll();
        if (!enabled) return;
        (data.dynamic || []).forEach(e => this.addEffect(e.id, "dynamic", e.type, e.config));
        (data.static || []).forEach(e => this.addEffect(e.id, "static", e.type, e.config));
    }
}

// ==========================================
// EFFECTS EDITOR UI — 2-column, popup-based
// ==========================================
class EffectsEditorUI {
    constructor(engine) {
        this.engine = engine;
        this.popup = null;
        this.isDirty = false;
        this.isSaved = false;
        this.canExit = false;
        this.exitTimer = null;
        this.workingState = null;
        this.columnLists = {};
        this.subPopups = new Set();
    }

    initialize() {
        const toggle = document.getElementById("particles_animation");
        if (!toggle) return;

        const data = getSettings().particles || { enabled: false, dynamic: [], static: [] };
        toggle.checked = data.enabled;
        this.engine.loadState(data, data.enabled);

        toggle.addEventListener("change", (e) => {
            const isEnabled = e.target.checked;
            const current = getSettings().particles || { enabled: false, dynamic: [], static: [] };
            current.enabled = isEnabled;
            if (isEnabled) this.engine.loadState(current, true);
            else this.engine.stopAll();
            saveSettings({ particles: current });
        });

        const editBtn = document.getElementById("edit_particles_settings");
        if (editBtn) editBtn.addEventListener("mousedown", () => this.openEditor());
    }

    openEditor() {
        if (this.popup) return;

        const saved = getSettings().particles || { enabled: false, dynamic: [], static: [] };
        this.workingState = JSON.parse(JSON.stringify({
            dynamic: saved.dynamic || [],
            static: saved.static || [],
        }));
        this.isDirty = false;
        this.isSaved = false;
        this.columnLists = {};

        const content = this._buildEditorContent();
        this.popup = openCustomPopup(
            t("setting_panel.wallpaper_customization.particles_settings"),
            content,
            "540px",
            { id: "effects_editor", canClose: true, hideUI: true }
        );
        this.popup.closeBtn?.addEventListener("popupBeforeClose", (e) => this._handleBeforeClose(e));

        // Close dropdowns when clicking outside — stored for cleanup
        this._closeDropdown = (e) => {
            if (!e.target.closest(".effects_add_area")) {
                document.querySelectorAll(".effects_add_dropdown").forEach(d => d.classList.remove("open"));
            }
        };
        document.addEventListener("mousedown", this._closeDropdown);
    }

    // ── UI Building ──────────────────────────────

    _buildEditorContent() {
        const wrapper = document.createElement("div");
        wrapper.className = "popup_body effects_editor";

        const columns = document.createElement("div");
        columns.className = "effects_columns";
        columns.appendChild(this._buildColumn("dynamic", "particles_animation.wallpaper_layer"));
        columns.appendChild(this._buildColumn("static", "particles_animation.screen_layer"));
        wrapper.appendChild(columns);

        const tooltip = document.createElement("p");
        tooltip.className = "tooltip";
        tooltip.style.margin = '0px'
        tooltip.setAttribute("data-i18n", "particles_animation.editor_tooltip");
        tooltip.textContent = t("particles_animation.editor_tooltip");

        const actions = document.createElement("div");
        actions.className = "actions";

        const btnClearAll = document.createElement("button");
        btnClearAll.className = "secondary";
        btnClearAll.textContent = t("particles_animation.btn_clear_all");
        btnClearAll.onmousedown = () => this._handleReset();

        const btnSave = document.createElement("button");
        btnSave.className = "primary";
        btnSave.textContent = t("particles_animation.btn_save");
        btnSave.onmousedown = () => this._handleSave();

        actions.append(btnClearAll, btnSave);
        wrapper.appendChild(tooltip);
        wrapper.appendChild(actions);
        return wrapper;
    }

    _buildColumn(layer, i18nKey) {
        const col = document.createElement("div");
        col.className = "effects_column";

        const title = document.createElement("p");
        title.className = "effects_column_title";
        title.setAttribute("data-i18n", i18nKey);
        title.textContent = t(i18nKey);

        const list = document.createElement("div");
        list.className = "effects_list";
        this.columnLists[layer] = list;

        col.append(title, list, this._buildAddArea(layer, list));
        this._refreshList(layer);
        return col;
    }

    _buildAddArea(layer, list) {
        const area = document.createElement("div");
        area.className = "effects_add_area";

        const btn = document.createElement("button");
        btn.className = "effects_add_btn secondary";
        btn.textContent = `+ ${t("particles_animation.add_effect") || "Thêm hiệu ứng"}`;

        const dropdown = document.createElement("div");
        dropdown.className = "effects_add_dropdown";

        const registry = layer === "static" ? STATIC_EFFECTS : DYNAMIC_EFFECTS;
        for (const [type] of Object.entries(registry)) {
            const item = document.createElement("div");
            item.className = "dropdown_item";
            item.textContent = t(`particles_animation.${type}.label`) || type;
            item.onmousedown = (e) => {
                e.stopPropagation();
                this._addEffect(layer, type, list);
                dropdown.classList.remove("open");
            };
            dropdown.appendChild(item);
        }

        btn.onmousedown = (e) => {
            e.stopPropagation();
            // Close all other dropdowns first
            document.querySelectorAll(".effects_add_dropdown").forEach(d => {
                if (d !== dropdown) d.classList.remove("open");
            });
            dropdown.classList.toggle("open");
        };

        area.append(btn, dropdown);
        return area;
    }

    _buildEffectCard(effectData, layer) {
        const card = document.createElement("div");
        card.className = "effect_card";

        const nameEl = document.createElement("span");
        nameEl.className = "effect_card_name";
        nameEl.textContent = t(`particles_animation.${effectData.type}.label`) || effectData.type;

        const controls = document.createElement("div");
        controls.className = "effect_card_controls";

        const makeBtn = (content, handler) => {
            const b = document.createElement("button");
            b.innerHTML = content;
            b.onmousedown = (e) => {
                e.stopPropagation();
                handler(e);
            };
            return b;
        };

        const btnUp = makeBtn(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`, () => {
            const arr = this.workingState[layer];
            const idx = arr.findIndex(e => e.id === effectData.id);
            if (idx <= 0) return;
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            this.engine.reorderEffect(effectData.id, layer, "up");
            this._refreshList(layer);
            this.isDirty = true;
        });

        const btnDown = makeBtn(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>`, () => {
            const arr = this.workingState[layer];
            const idx = arr.findIndex(e => e.id === effectData.id);
            if (idx < 0 || idx >= arr.length - 1) return;
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            this.engine.reorderEffect(effectData.id, layer, "down");
            this._refreshList(layer);
            this.isDirty = true;
        });

        const btnSettings = makeBtn(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`, () => {
            this._openEffectSettings(effectData, layer);
        });

        const btnDelete = makeBtn(`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`, () => {
            const arr = this.workingState[layer];
            const idx = arr.findIndex(e => e.id === effectData.id);
            if (idx >= 0) arr.splice(idx, 1);
            this.engine.removeEffect(effectData.id, layer);
            this._refreshList(layer);
            this.isDirty = true;
        });

        controls.append(btnUp, btnDown, btnSettings, btnDelete);
        card.append(nameEl, controls);
        return card;
    }

    // ── Actions ──────────────────────────────────

    _addEffect(layer, type, list) {
        const arr = this.workingState[layer];
        if (arr.length >= EffectsEngine.MAX_PER_LAYER) {
            showNotification(t("particles_animation.max_effects_reached"), "warning");
            return;
        }
        const id = genId();
        const EffectClass = ALL_EFFECTS[type];
        const config = { ...(EffectClass.DEFAULTS || {}) };
        const effectData = { id, type, config };

        arr.push(effectData);
        this.engine.addEffect(id, layer, type, config);
        this._refreshList(layer);
        this.isDirty = true;
    }

    _refreshList(layer) {
        const list = this.columnLists[layer];
        if (!list) return;
        list.innerHTML = "";
        const effects = this.workingState[layer] || [];

        if (effects.length === 0) {
            const placeholder = document.createElement("div");
            placeholder.className = "effects_placeholder";
            placeholder.setAttribute("data-i18n", "particles_animation.no_effects");
            placeholder.textContent = t("particles_animation.no_effects");
            list.appendChild(placeholder);
        } else {
            effects.forEach(e =>
                list.appendChild(this._buildEffectCard(e, layer))
            );
        }
    }

    _openEffectSettings(effectData, layer) {
        const EffectClass = ALL_EFFECTS[effectData.type];
        if (!EffectClass) return;
        const htmlStr = EffectClass.getSettingsHTML();
        if (!htmlStr) return;

        const container = document.createElement("div");
        container.className = "popup_body";
        container.innerHTML = htmlStr;
        translateDOM(container);

        // Sync inputs with current config + live preview on change
        container.querySelectorAll("input[data-key]").forEach(input => {
            const key = input.dataset.key;
            const val = effectData.config[key];
            if (val === undefined) return;

            input.value = val;

            const sync = (newVal) => {
                let parsed = parseFloat(newVal);
                if (isNaN(parsed)) return;
                const min = parseFloat(input.min), max = parseFloat(input.max);
                if (!isNaN(min)) parsed = Math.max(min, parsed);
                if (!isNaN(max)) parsed = Math.min(max, parsed);

                effectData.config[key] = parsed;
                container.querySelectorAll(`input[data-key="${key}"]`).forEach(s => { s.value = parsed; });
                this.engine.updateEffectConfig(effectData.id, layer, { [key]: parsed });
                this.isDirty = true;
            };

            if (input.type === "range") input.oninput = () => sync(input.value);
            input.onchange = () => sync(input.value);
        });

        // Action row: Only Reset to Defaults (Save is automatic, Preview is live)
        const settingsActions = document.createElement("div");
        settingsActions.className = "actions";

        const btnResetEffect = document.createElement("button");
        btnResetEffect.className = "secondary";
        btnResetEffect.textContent = t("particles_animation.btn_reset_effect");
        btnResetEffect.onmousedown = (e) => {
            e.stopPropagation();
            const EffectClassForReset = ALL_EFFECTS[effectData.type];
            const defaults = { ...(EffectClassForReset.DEFAULTS || {}) };
            container.querySelectorAll("input[data-key]").forEach(inp => {
                const k = inp.dataset.key;
                if (defaults[k] !== undefined) inp.value = defaults[k];
            });
            Object.assign(effectData.config, defaults);
            this.engine.updateEffectConfig(effectData.id, layer, defaults);
            this.isDirty = true;
            showNotification(t("particles_animation.reset_success"), "success");
        };

        settingsActions.append(btnResetEffect);
        container.appendChild(settingsActions);

        const label = t(`particles_animation.${effectData.type}.label`) || effectData.type;
        const sub = openCustomPopup(label, container, "440px", { canClose: true });
        this.subPopups.add(sub);

        // Reset reference when it's closed manually
        sub.closeBtn?.addEventListener("mousedown", () => {
            this.subPopups.delete(sub);
        });
    }

    _handleReset() {
        this.engine.stopAll();
        this.workingState = { dynamic: [], static: [] };
        this._refreshList("dynamic");
        this._refreshList("static");
        this.isDirty = true;
        showNotification(t("particles_animation.clear_all_success"), "success");
    }

    _handleSave() {
        const current = getSettings().particles || { enabled: false };
        current.dynamic = this.workingState.dynamic;
        current.static = this.workingState.static;
        saveSettings({ particles: current });
        this.engine.loadState(current, current.enabled);

        showNotification(t("alert.saved_changes"), "success");
        this.isSaved = true;
        this.isDirty = false;
        this.popup?.closeBtn?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }

    _handleBeforeClose(e) {
        if (this.isDirty && !this.canExit) {
            e.preventDefault();
            showNotification(t("alert.unsaved_changes"), "warning");
            this.canExit = true;
            if (this.exitTimer) clearTimeout(this.exitTimer);
            this.exitTimer = setTimeout(() => (this.canExit = false), 5000);
        } else {
            if (!this.isSaved) {
                const data = getSettings().particles || { enabled: false, dynamic: [], static: [] };
                this.engine.loadState(data, data.enabled);
            }

            // Close any active sub-config popups
            this.subPopups.forEach(p => p.closePopup());
            this.subPopups.clear();

            // Cleanup document listener
            if (this._closeDropdown) {
                document.removeEventListener("mousedown", this._closeDropdown);
                this._closeDropdown = null;
            }
            this.popup = null;
        }
    }
}

// ==========================================
// INIT
// ==========================================
const engine = new EffectsEngine();
const editor = new EffectsEditorUI(engine);

export function initializeParticles() {
    editor.initialize();
}

