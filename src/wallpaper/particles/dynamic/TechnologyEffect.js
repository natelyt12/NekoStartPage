import { ParticleEffect } from "../ParticleEffect.js";
import { t } from "/src/core/i18n.js";

// ==========================================
// TECHNOLOGY (NODES & LINES) EFFECT
// ==========================================
export class TechnologyEffect extends ParticleEffect {
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

        // Flat-layer parallax: all nodes shift equally (no depth variation)
        // Factor 0.5 places this layer between wallpaper (1.0) and HUD (0.0)
        const amplitude = this.parallaxAmplitude !== undefined ? this.parallaxAmplitude : -30;
        const flatOffsetX = (this.mouseX || 0) * amplitude * 0.5;
        const flatOffsetY = (this.mouseY || 0) * (amplitude * 0.65) * 0.5;

        ctx.fillStyle = color;
        ctx.strokeStyle = color;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const rx = p.x + flatOffsetX;
            const ry = p.y + flatOffsetY;

            ctx.beginPath();
            ctx.arc(rx, ry, size, 0, Math.PI * 2);
            ctx.fill();

            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const rx2 = p2.x + flatOffsetX;
                const ry2 = p2.y + flatOffsetY;
                const dx = rx - rx2;
                const dy = ry - ry2;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < lineDist) {
                    ctx.beginPath();
                    ctx.globalAlpha = 1 - dist / lineDist;
                    ctx.moveTo(rx, ry);
                    ctx.lineTo(rx2, ry2);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
        }
    }

    static getSettingsSpec() {
        return [
            { key: "count", label: t("particles.technology.count"), min: 10, max: 300, step: 10, unit: "hạt" },
            { key: "speed", label: t("particles.technology.speed"), min: 0.1, max: 3, step: 0.1, unit: "x" },
            { key: "lineDist", label: t("particles.technology.lineDist"), min: 10, max: 300, step: 10, unit: "px" }
        ];
    }
}
