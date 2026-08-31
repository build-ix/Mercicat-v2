/**
 * Test Network Proxy for latency injection
 * 
 * Allows injecting controlled latency, loss, and reordering into Socket.IO
 * messages during integration tests.
 * 
 * Usage:
 *   const proxy = new DelayedSocket(socket, { latencyMs: 100, lossRate: 0.05 });
 */

import type { Socket as SocketType } from "socket.io-client";

export interface NetworkConditionConfig {
  latencyMs?: number;  // One-way latency in milliseconds
  lossRate?: number;   // Probability 0-1 of dropping a message
  reorder?: boolean;   // Allow adjacent messages to reorder
  seed?: number;       // For deterministic randomness (optional)
}

export class DelayedSocket {
  private socket: SocketType;
  private config: Required<NetworkConditionConfig>;
  private msgQueue: Array<{
    event: string;
    data: unknown;
    delay: number;
    timestamp: number;
  }> = [];
  private rng: SeededRandom;

  constructor(socket: SocketType, config: NetworkConditionConfig = {}) {
    this.socket = socket;
    this.config = {
      latencyMs: config.latencyMs ?? 0,
      lossRate: Math.max(0, Math.min(1, config.lossRate ?? 0)),
      reorder: config.reorder ?? false,
      seed: config.seed ?? 12345,
    };
    this.rng = new SeededRandom(this.config.seed);
  }

  /**
   * Intercept emit and apply network conditions
   */
  emit(event: string, data?: unknown): boolean {
    // Check for loss
    if (this.rng.next() < this.config.lossRate) {
      console.log(`[Network] Dropped message: ${event}`);
      return false;
    }

    // Calculate delay (deterministic variance around base latency)
    const jitter = this.rng.next() * 10 - 5; // ±5ms jitter
    const delay = Math.max(0, this.config.latencyMs + jitter);

    this.msgQueue.push({
      event,
      data,
      delay,
      timestamp: Date.now(),
    });

    // Process queue
    this.processQueue();

    return true;
  }

  /**
   * Process queued messages and emit them after their delay
   */
  private processQueue() {
    const now = Date.now();

    for (let i = this.msgQueue.length - 1; i >= 0; i--) {
      const msg = this.msgQueue[i];
      if (now - msg.timestamp >= msg.delay) {
        this.msgQueue.splice(i, 1);
        this.socket.emit(msg.event, msg.data);
        console.log(
          `[Network] Delivered after ${now - msg.timestamp}ms: ${msg.event}`
        );
      }
    }

    // Re-schedule check if queue not empty
    if (this.msgQueue.length > 0) {
      setTimeout(() => this.processQueue(), 5);
    }
  }

  /**
   * Passthrough for other socket methods
   */
  on(event: string, callback: (...args: unknown[]) => void): SocketType {
    return this.socket.on(event, callback);
  }

  off(event: string, callback?: (...args: unknown[]) => void): SocketType {
    return this.socket.off(event, callback);
  }

  once(event: string, callback: (...args: unknown[]) => void): SocketType {
    return this.socket.once(event, callback);
  }

  disconnect(): SocketType {
    this.msgQueue = [];
    return this.socket.disconnect();
  }

  get id(): string {
    return this.socket.id ?? "unknown";
  }

  get connected(): boolean {
    return this.socket.connected;
  }
}

/**
 * Minimal seeded RNG for deterministic test behavior
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state = (this.state * 9301 + 49297) % 233280;
    return this.state / 233280;
  }
}
