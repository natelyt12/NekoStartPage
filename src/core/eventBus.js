/**
 * Global EventBus wrapper over native DOM Events.
 * Provides debugging visibility and enforces the use of registered EVENT constants.
 */
class GlobalEventBus {
    constructor() {
        this.isDebug = import.meta.env?.DEV || false;
    }

    /**
     * Dispatch an event to the global scope.
     * @param {string} eventName - The event constant from EVENTS.
     * @param {any} [detail] - Optional data payload to attach to the event.
     * @param {string} [emitterName="unknown"] - Name of the component dispatching the event (for debugging).
     */
    emit(eventName, detail = null, emitterName = "unknown") {
        if (this.isDebug) {
            console.log(`[EventBus] Emit: "${eventName}" from [${emitterName}]`, detail || "");
        }
        const event = new CustomEvent(eventName, { detail, bubbles: true });
        document.dispatchEvent(event);
    }

    /**
     * Subscribe to a global event.
     * @param {string} eventName - The event constant from EVENTS.
     * @param {Function} callback - The listener function receiving the event.
     * @param {string} [listenerName="unknown"] - Name of the component listening (for debugging).
     * @returns {Function} Unsubscribe function.
     */
    on(eventName, callback, listenerName = "unknown") {
        if (this.isDebug) {
            console.log(`[EventBus] Subscribe: "${eventName}" by [${listenerName}]`);
        }
        document.addEventListener(eventName, callback);

        return () => {
            if (this.isDebug) {
                console.log(`[EventBus] Unsubscribe: "${eventName}" by [${listenerName}]`);
            }
            document.removeEventListener(eventName, callback);
        };
    }

    /**
     * Subscribe to a global event exactly once.
     */
    once(eventName, callback, listenerName = "unknown") {
        if (this.isDebug) {
            console.log(`[EventBus] Subscribe (Once): "${eventName}" by [${listenerName}]`);
        }
        document.addEventListener(eventName, callback, { once: true });
    }
}

export const EventBus = new GlobalEventBus();
