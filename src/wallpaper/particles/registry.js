import { TechnologyEffect } from "./dynamic/TechnologyEffect.js";
import { SnowEffect } from "./dynamic/SnowEffect.js";
import { RainEffect } from "./dynamic/RainEffect.js";
import { DustEffect } from "./dynamic/DustEffect.js";
import { PetalsEffect } from "./dynamic/PetalsEffect.js";
import { FirefliesEffect } from "./dynamic/FirefliesEffect.js";

import { NoiseEffect } from "./static/NoiseEffect.js";
import { VignetteEffect } from "./static/VignetteEffect.js";
import { CinematicEffect } from "./static/CinematicEffect.js";

export const DYNAMIC_EFFECTS = {
    [TechnologyEffect.ID]: TechnologyEffect,
    [SnowEffect.ID]: SnowEffect,
    [RainEffect.ID]: RainEffect,
    [DustEffect.ID]: DustEffect,
    [PetalsEffect.ID]: PetalsEffect,
    [FirefliesEffect.ID]: FirefliesEffect,
};

export const STATIC_EFFECTS = {
    [NoiseEffect.ID]: NoiseEffect,
    [VignetteEffect.ID]: VignetteEffect,
    [CinematicEffect.ID]: CinematicEffect,
};

export const ALL_EFFECTS = { ...DYNAMIC_EFFECTS, ...STATIC_EFFECTS };
