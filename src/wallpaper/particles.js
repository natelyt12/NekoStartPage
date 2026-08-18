import { subscribe } from "/src/core/storageHandler.js";
import { EffectsEngine } from "./particles/EffectsEngine.js";
import { EffectsEditorUI } from "./particles/EffectsEditorUI.js";

export { ParticleEffect } from "./particles/ParticleEffect.js";
export { TechnologyEffect } from "./particles/dynamic/TechnologyEffect.js";
export { SnowEffect } from "./particles/dynamic/SnowEffect.js";
export { RainEffect } from "./particles/dynamic/RainEffect.js";
export { DustEffect } from "./particles/dynamic/DustEffect.js";
export { PetalsEffect } from "./particles/dynamic/PetalsEffect.js";
export { FirefliesEffect } from "./particles/dynamic/FirefliesEffect.js";

export { NoiseEffect } from "./particles/static/NoiseEffect.js";
export { VignetteEffect } from "./particles/static/VignetteEffect.js";
export { CinematicEffect } from "./particles/static/CinematicEffect.js";

export { DYNAMIC_EFFECTS, STATIC_EFFECTS, ALL_EFFECTS } from "./particles/registry.js";
export { EffectsEngine } from "./particles/EffectsEngine.js";
export { EffectsEditorUI } from "./particles/EffectsEditorUI.js";

const engine = new EffectsEngine();
const editor = new EffectsEditorUI(engine);

// Subscribe reactively to "particles" configuration
subscribe("particles", (particlesConfig) => {
    engine.loadState(particlesConfig);
});

export function initializeParticles() {
    editor.initialize();
}
