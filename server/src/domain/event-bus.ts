import type { VoiceEventName, VoiceEventHandler, VoiceEventPayload } from "./events/voice-events.js";

/**
 * Minimal typed event bus. Every `on()` returns an unsubscribe function so
 * callers can clean up listeners (no leaked subscriptions).
 *
 * Generic `any` payloads are intentionally avoided — the handler signature is
 * derived from {@link VoiceEventMap}.
 */
export class EventBus {
  private readonly handlers = new Map<VoiceEventName, Set<VoiceEventHandler<VoiceEventName>>>();

  on<E extends VoiceEventName>(event: E, handler: VoiceEventHandler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as VoiceEventHandler<VoiceEventName>);
    return () => this.off(event, handler);
  }

  once<E extends VoiceEventName>(event: E, handler: VoiceEventHandler<E>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<E extends VoiceEventName>(event: E, handler: VoiceEventHandler<E>): void {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler as VoiceEventHandler<VoiceEventName>);
      if (set.size === 0) this.handlers.delete(event);
    }
  }

  emit<E extends VoiceEventName>(event: E, payload: VoiceEventPayload<E>): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy to avoid mutation-during-iteration issues if a handler unsubscribes.
    for (const handler of [...set]) {
      try {
        (handler as VoiceEventHandler<E>)(payload);
      } catch (err) {
        // A listener throwing must not break other listeners or the emitter.
        console.error(`[EventBus] handler for "${event}" threw:`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
