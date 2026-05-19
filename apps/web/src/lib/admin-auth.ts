export const isAdminAuthDisabled =
  import.meta.env.VITE_ADMIN_AUTH_MODE === 'disabled';

export function isLocalAdminHost(): boolean {
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}
