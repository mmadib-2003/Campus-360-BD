// apps/mobile/services/offline-queue.ts
import * as SecureStore from 'expo-secure-store';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH';
  body: Record<string, unknown>;
  createdAt: number;
}

const QUEUE_KEY = 'campus360_offline_write_queue';

export async function enqueueOfflineWrite(mutation: QueuedMutation): Promise<void> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);
  const list: QueuedMutation[] = raw ? JSON.parse(raw) : [];
  list.push(mutation);
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(list));
}

export async function flushOfflineWriteQueue(baseUrl: string, token: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(QUEUE_KEY);
  if (!raw) return 0;
  const list: QueuedMutation[] = JSON.parse(raw);
  const remaining: QueuedMutation[] = [];
  let flushed = 0;

  for (const item of list) {
    try {
      const res = await fetch(`${baseUrl}${item.endpoint}`, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item.body),
      });
      if (res.ok) {
        flushed++;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(remaining));
  return flushed;
}
