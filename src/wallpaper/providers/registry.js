import { WallhavenProvider } from "./impl/wallhaven/WallhavenProvider.js";
import { PicreProvider } from "./impl/picre/PicreProvider.js";
import { CollectionProvider } from "./impl/collection/CollectionProvider.js";
import { UnsplashProvider } from "./impl/unsplash/UnsplashProvider.js";

export const PROVIDER_REGISTRY = {
    [WallhavenProvider.prototype.constructor.name]: WallhavenProvider,
    wallhaven: WallhavenProvider,
    picre: PicreProvider,
    collection: CollectionProvider,
    unsplash: UnsplashProvider,
};
