// packages/shared/src/api-client.ts
export async function apiFetch<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<{ success: boolean; data?: T; error?: { code: string; message_en: string; message_bn: string } }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return res.json();
}
