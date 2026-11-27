const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');

export async function friendsRequest(path, options = {}, onSessionExpired) {
  const response = await fetch(`${apiBaseUrl}/api/friends${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) onSessionExpired?.();
  if (!response.ok) throw new Error(result.error || 'Could not load friends.');
  return result;
}
