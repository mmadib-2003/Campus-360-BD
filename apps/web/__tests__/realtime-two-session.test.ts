// apps/web/__tests__/realtime-two-session.test.ts
/**
 * Two-session realtime contract tests (verification template).
 *
 * Two browser sessions ("tabs") share localStorage + BroadcastChannel, which is
 * exactly the transport the demo/preview store uses when Supabase Realtime is
 * not configured. Each test writes from session A and asserts that session B
 * receives the event AND observes the updated row within the same tick — the
 * same contract Supabase Realtime satisfies in production (marketplace listing,
 * civic upvote, blood request, lost-found match, event RSVP).
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

// ---------------------------------------------------------------------------
// Minimal browser shims: localStorage + BroadcastChannel (cross-instance pub/sub)
// ---------------------------------------------------------------------------
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const channelsByName = new Map<string, Set<ShimBroadcastChannel>>();

class ShimBroadcastChannel {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(public name: string) {
    if (!channelsByName.has(name)) channelsByName.set(name, new Set());
    channelsByName.get(name)!.add(this);
  }
  postMessage(data: unknown) {
    for (const peer of channelsByName.get(this.name) ?? []) {
      if (peer !== this) peer.onmessage?.({ data });
    }
  }
  close() {
    channelsByName.get(this.name)?.delete(this);
  }
}

function installWindowShim() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const storage = new MemoryStorage();
  const shim: any = {
    localStorage: storage,
    addEventListener(type: string, callback: (event: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(callback);
    },
    removeEventListener(type: string, callback: (event: unknown) => void) {
      listeners.get(type)?.delete(callback);
    },
    dispatchEvent() {
      return true;
    },
  };
  (globalThis as any).window = shim;
  (globalThis as any).BroadcastChannel = ShimBroadcastChannel;
  (globalThis as any).CustomEvent = class CustomEvent<T> {
    detail: T;
    constructor(type: string, init?: { detail?: T }) {
      this.detail = init?.detail as T;
    }
  };
  return { storage };
}

const { storage } = installWindowShim();

let demo: typeof import('../lib/modules/demo-data');

beforeAll(async () => {
  vi.resetModules();
  demo = await import('../lib/modules/demo-data');
});

/** Session A: writes through the shared store. Session B: subscribes + reads. */
function twoSessions() {
  const eventsForB: unknown[] = [];
  const channelB = new ShimBroadcastChannel('campus360:demo-realtime');
  channelB.onmessage = (event) => eventsForB.push(event.data);
  return {
    eventsForB,
    closeB: () => channelB.close(),
  };
}

function freshStore() {
  storage.clear();
}

describe('two-session realtime (marketplace, civic, blood, lost-found, events)', () => {
  it('propagates a new marketplace listing to session B', () => {
    freshStore();
    const { eventsForB, closeB } = twoSessions();

    const created = demo.demoInsert('marketplace_listings', {
      title: 'Engineering Drawing Board',
      description: 'Like new, used for one semester.',
      category: 'Books',
      kind: 'SELL',
      price_bdt: 450,
      status: 'AVAILABLE',
    });

    expect(eventsForB.length).toBeGreaterThan(0);
    const visible = demo.demoList('marketplace_listings').some((row) => row.id === created.id);
    expect(visible).toBe(true);
    closeB();
  });

  it('propagates a civic upvote and bumps the ticket counter for session B', () => {
    freshStore();
    const before = demo.demoList('complaints_public')[0];
    expect(before).toBeTruthy();
    const { eventsForB, closeB } = twoSessions();

    demo.demoInsert('complaint_upvotes', {
      complaint_id: before.id,
      user_id: 'demo-user-observer',
    });

    const after = demo.demoList('complaints_public').find((row) => row.id === before.id);
    expect(Number(after?.upvotes_count)).toBe(Number(before.upvotes_count ?? 0) + 1);
    expect(eventsForB.length).toBeGreaterThan(0);
    closeB();
  });

  it('propagates a new blood request to session B', () => {
    freshStore();
    const { eventsForB, closeB } = twoSessions();

    const created = demo.demoInsert('blood_requests', {
      patient_name: 'Emergency Patient',
      blood_group: 'O+',
      bags_needed: 2,
      hospital_name: 'Dhaka Medical College',
      hospital_address: 'Bakshibazar, Dhaka',
      contact_phone: '+880-1700-000000',
      urgency: 'CRITICAL',
      status: 'OPEN',
    });

    expect(eventsForB.length).toBeGreaterThan(0);
    expect(demo.demoList('blood_requests').some((row) => row.id === created.id)).toBe(true);
    closeB();
  });

  it('creates a lost-found match when a FOUND item meets an OPEN LOST report', () => {
    freshStore();
    const lostBefore = demo
      .demoList('lost_items')
      .find((row) => String(row.kind).toUpperCase() === 'LOST' && String(row.status).toUpperCase() === 'OPEN');
    expect(lostBefore).toBeTruthy();
    const { eventsForB, closeB } = twoSessions();

    const found = demo.demoInsert('lost_items', {
      kind: 'FOUND',
      title: 'Found: black calculator',
      description: 'Found near the library steps.',
      category: lostBefore!.category,
      location_en: 'Central Library',
      status: 'OPEN',
    });

    const matches = demo.demoTable('lost_item_matches').filter(
      (row: Row) => String(row.lost_item_id) === String(lostBefore!.id) && String(row.found_item_id) === String(found.id)
    );
    expect(matches.length).toBe(1);

    const lostAfter = demo.demoTable('lost_items').find((row: Row) => String(row.id) === String(lostBefore!.id));
    expect(String(lostAfter?.status)).toBe('RESOLVED');

    const notified = demo.demoTable('notifications').some((row: Row) => row.category === 'LOST_FOUND_MATCH');
    expect(notified).toBe(true);
    expect(eventsForB.length).toBeGreaterThan(0);
    closeB();
  });

  it('propagates an event RSVP and bumps the counter for session B', () => {
    freshStore();
    const event = demo.demoList('events')[0];
    expect(event).toBeTruthy();
    const { eventsForB, closeB } = twoSessions();

    demo.demoInsert('event_rsvps', {
      event_id: event.id,
      user_id: 'demo-user-observer',
      status: 'GOING',
    });

    const after = demo.demoList('events').find((row) => row.id === event.id);
    expect(Number(after?.rsvp_count)).toBe(Number(event.rsvp_count ?? 0) + 1);
    expect(eventsForB.length).toBeGreaterThan(0);
    closeB();
  });
});
