/**
 * webhook-event-queue.ts
 *
 * Module-level in-memory event queue for normalized channel events.
 *
 * This queue is intentionally simple: it lives in the Node.js server process
 * memory and survives across HTTP requests within the same process instance.
 *
 * ⚠️  Limitations (acceptable for this prototype):
 *   - Events are lost on server restart or cold start.
 *   - Not shared across multiple server instances (single-node only).
 *   - In production, replace with a durable queue (Redis, SQS, RabbitMQ…).
 */

import type { ChannelEvent, QueuedEvent } from "@/types/webhook-event";

const MAX_QUEUE_SIZE = 1_000;

// Declared with `var` so Hot Module Replacement in Next.js dev mode doesn't
// re-initialize to an empty array on every file change.
declare global {
  // eslint-disable-next-line no-var
  var __freiaWebhookQueue: QueuedEvent[] | undefined;
}

function getQueue(): QueuedEvent[] {
  if (!globalThis.__freiaWebhookQueue) {
    globalThis.__freiaWebhookQueue = [];
  }
  return globalThis.__freiaWebhookQueue;
}

/**
 * Adds a normalized event to the tail of the queue.
 * Silently drops the oldest event when the queue is full.
 */
export function enqueue(event: ChannelEvent): void {
  const q = getQueue();
  if (q.length >= MAX_QUEUE_SIZE) {
    q.shift(); // drop oldest
  }
  q.push({
    event,
    attempts: 0,
    enqueuedAt: new Date().toISOString(),
  });
}

/**
 * Removes and returns all queued events (FIFO order).
 * Callers are responsible for processing or re-queuing on failure.
 */
export function drain(): QueuedEvent[] {
  const q = getQueue();
  return q.splice(0);
}

/**
 * Returns a snapshot of the queue without removing items.
 */
export function peek(limit = 50): QueuedEvent[] {
  return getQueue().slice(0, limit);
}

/**
 * Current queue depth — useful for health checks.
 */
export function depth(): number {
  return getQueue().length;
}
