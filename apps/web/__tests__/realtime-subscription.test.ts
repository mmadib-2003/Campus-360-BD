// apps/web/__tests__/realtime-subscription.test.ts
/**
 * Regression tests for the Supabase Realtime crash:
 *
 *   cannot add postgres_changes callbacks for realtime:campus360:<table>:
 *   after subscribe()
 *
 * The fake client below reproduces the two behaviours of supabase-js that made
 * the crash reachable:
 *   • `channel(topic)` returns the *existing* channel for a topic;
 *   • calling `.on('postgres_changes', ...)` on an already-subscribed channel
 *     throws synchronously.
 *
 * These tests pin the contract the UI depends on: `.on()` before `.subscribe()`,
 * a unique topic per subscription, `removeChannel()` on cleanup, and no throw
 * escaping into React.
 */

import { describe, expect, it, vi } from 'vitest';
import { createRealtimeTopic, subscribeToTable } from '../lib/realtime';

type Handler = (payload: unknown) => void;

class FakeChannel {
  topic: string;
  client: FakeSupabase;
  subscribed = false;
  postgresHandlers: Handler[] = [];
  statusHandlers: Array<(status: string) => void> = [];
  removed = false;

  constructor(topic: string, client: FakeSupabase) {
    this.topic = topic;
    this.client = client;
  }

  on(event: string, _filter: unknown, handler: Handler) {
    if (event === 'postgres_changes' && this.subscribed) {
      throw new Error(
        `cannot add postgres_changes callbacks for realtime:${this.topic}: after subscribe()`
      );
    }
    this.postgresHandlers.push(handler);
    return this;
  }

  subscribe(statusHandler?: (status: string) => void) {
    this.subscribed = true;
    if (statusHandler) this.statusHandlers.push(statusHandler);
    return this;
  }

  unsubscribe() {
    this.subscribed = false;
    this.removed = true;
    return Promise.resolve('ok');
  }

  emit(eventType: 'INSERT' | 'UPDATE' | 'DELETE', row: Record<string, unknown>) {
    const payload = { eventType, new: row, old: row };
    for (const handler of this.postgresHandlers) handler(payload);
  }

  emitStatus(status: string) {
    for (const handler of this.statusHandlers) handler(status);
  }
}

class FakeSupabase {
  channels = new Map<string, FakeChannel>();
  removedTopics: string[] = [];

  channel(topic: string) {
    const existing = this.channels.get(topic);
    if (existing) return existing;
    const created = new FakeChannel(topic, this);
    this.channels.set(topic, created);
    return created;
  }

  removeChannel(channel: FakeChannel) {
    this.channels.delete(channel.topic);
    this.removedTopics.push(channel.topic);
    return Promise.resolve('ok');
  }
}

function asClient(client: FakeSupabase): any {
  return client;
}

describe('realtime subscription hardening', () => {
  it('chains .on(postgres_changes) before .subscribe()', () => {
    const client = new FakeSupabase();
    const order: string[] = [];

    const originalOn = FakeChannel.prototype.on;
    const originalSubscribe = FakeChannel.prototype.subscribe;
    FakeChannel.prototype.on = function (...args: Parameters<FakeChannel['on']>) {
      order.push('on');
      return originalOn.apply(this, args);
    };
    FakeChannel.prototype.subscribe = function (...args: Parameters<FakeChannel['subscribe']>) {
      order.push('subscribe');
      return originalSubscribe.apply(this, args);
    };

    try {
      const cleanup = subscribeToTable(asClient(client), 'marketplace_listings', {}, { topicBase: 'test' });
      expect(order).toEqual(['on', 'subscribe']);
      cleanup();
    } finally {
      FakeChannel.prototype.on = originalOn;
      FakeChannel.prototype.subscribe = originalSubscribe;
    }
  });

  it('removes the channel from the client on cleanup', () => {
    const client = new FakeSupabase();
    const cleanup = subscribeToTable(asClient(client), 'marketplace_listings', {});
    expect(client.channels.size).toBe(1);
    cleanup();
    expect(client.channels.size).toBe(0);
    expect(client.removedTopics).toHaveLength(1);
  });

  it('is idempotent: a second cleanup does not remove another channel', () => {
    const client = new FakeSupabase();
    const cleanup = subscribeToTable(asClient(client), 'marketplace_listings', {});
    cleanup();
    cleanup();
    expect(client.removedTopics).toHaveLength(1);
  });

  it('survives a StrictMode unmount/remount with the same table and filter', () => {
    const client = new FakeSupabase();
    const options = { topicBase: 'campus360:complaints:track:CASE-1' };

    // Mount 1
    const cleanup1 = subscribeToTable(asClient(client), 'complaints', {}, options);
    cleanup1();

    // Mount 2 — must NOT reuse the just-subscribed channel.
    const cleanup2 = subscribeToTable(asClient(client), 'complaints', {}, options);
    expect(client.channels.size).toBe(1);
    cleanup2();
    expect(client.channels.size).toBe(0);
  });

  it('gives two components watching the same table distinct channels', () => {
    const client = new FakeSupabase();
    const cleanupA = subscribeToTable(asClient(client), 'blood_requests', {}, { topicBase: 'campus360:blood_requests' });
    const cleanupB = subscribeToTable(asClient(client), 'blood_requests', {}, { topicBase: 'campus360:blood_requests' });

    expect(client.channels.size).toBe(2);
    const topics = [...client.channels.keys()];
    expect(new Set(topics).size).toBe(2);

    cleanupA();
    cleanupB();
    expect(client.channels.size).toBe(0);
  });

  it('routes INSERT / UPDATE / DELETE payloads to the right handler', () => {
    const client = new FakeSupabase();
    const onInsert = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const cleanup = subscribeToTable(
      asClient(client),
      'reviews',
      { onInsert, onUpdate, onDelete },
      { filter: 'target_id=eq.123', event: '*' }
    );

    const channel = [...client.channels.values()][0];
    channel.emit('INSERT', { id: '1' });
    channel.emit('UPDATE', { id: '2' });
    channel.emit('DELETE', { id: '3' });

    expect(onInsert).toHaveBeenCalledWith({ id: '1' });
    expect(onUpdate).toHaveBeenCalledWith({ id: '2' });
    expect(onDelete).toHaveBeenCalledWith({ id: '3' });
    cleanup();
  });

  it('reports a CHANNEL_ERROR status through onError instead of throwing', () => {
    const client = new FakeSupabase();
    const onError = vi.fn();
    const cleanup = subscribeToTable(asClient(client), 'events', { onError });
    const channel = [...client.channels.values()][0];
    expect(() => channel.emitStatus('CHANNEL_ERROR')).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('contains a synchronous .on() failure and still releases the channel', () => {
    const client = new FakeSupabase();
    const onError = vi.fn();
    const originalChannel = client.channel.bind(client);
    client.channel = (topic: string) => {
      const channel = originalChannel(topic);
      const originalOn = channel.on.bind(channel);
      channel.on = () => {
        throw new Error('cannot add postgres_changes callbacks after subscribe()');
      };
      return channel;
    };

    const cleanup = subscribeToTable(asClient(client), 'events', { onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(client.channels.size).toBe(0);
    cleanup();
  });

  it('never reuses a topic across subscriptions', () => {
    const first = createRealtimeTopic('campus360:events');
    const second = createRealtimeTopic('campus360:events');
    expect(first).not.toBe(second);
    expect(first.startsWith('campus360:events:')).toBe(true);
  });
});
