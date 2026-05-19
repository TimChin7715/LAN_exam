import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AdminLocalhostOnly } from '@/components/auth/AdminLocalhostOnly';
import { AuthChecking } from '@/components/auth/AuthChecking';
import { isAdminAuthDisabled, isLocalAdminHost } from '@/lib/admin-auth';
import { useAuth } from '@/contexts/AuthContext';

const PUBLIC_ADMIN_PATHS = ['/admin/login'];

export function AdminRoute() {
  const { status } = useAuth();
  const location = useLocation();
  const isPublic = PUBLIC_ADMIN_PATHS.includes(location.pathname);

  if (!isLocalAdminHost()) {
    return <AdminLocalhostOnly />;
  }

  if (isAdminAuthDisabled) {
    return <Outlet />;
  }

  if (status === 'checking') {
    return <AuthChecking />;
  }

  if (status === 'unauthenticated' && !isPublic) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?redirect=${redirect}`} replace />;
  }

  if (status === 'mustChangePassword' && location.pathname !== '/admin/change-password') {
    return <Navigate to="/admin/change-password" replace />;
  }

  if (status === 'authenticated' && location.pathname === '/admin/change-password') {
    return <Navigate to="/admin" replace />;
  }

  if (
    (status === 'authenticated' || status === 'mustChangePassword') &&
    location.pathname === '/admin/login'
  ) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    const target =
      redirect && redirect.startsWith('/admin') ? decodeURIComponent(redirect) : '/admin';
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}

export function RequireAuthenticatedAdmin() {
  const { status } = useAuth();
  const location = useLocation();

  if (isAdminAuthDisabled) {
    return <Outlet />;
  }

  if (status === 'checking') {
    return <AuthChecking />;
  }

  if (status === 'unauthenticated') {
    const redirect = encodeURIComponent(location.pathname);
    return <Navigate to={`/admin/login?redirect=${redirect}`} replace />;
  }

  if (status === 'mustChangePassword') {
    return <Navigate to="/admin/change-password" replace />;
  }

  return <Outlet />;
}

export function RequireChangePassword() {
  const { status } = useAuth();

  if (isAdminAuthDisabled) {
    return <Navigate to="/admin" replace />;
  }

  if (status === 'checking') {
    return <AuthChecking />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
