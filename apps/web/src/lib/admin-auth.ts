export const isAdminAuthDisabled =
  import.meta.env.VITE_ADMIN_AUTH_MODE === 'disabled';

export function isLocalAdminHost(): boolean {
  if (import.meta.env.VITE_ADMIN_ALLOW_REMOTE === 'true') {
    return true;
  }
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
