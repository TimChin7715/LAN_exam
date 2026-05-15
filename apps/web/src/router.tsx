import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import {
  AdminRoute,
  RequireAuthenticatedAdmin,
  RequireChangePassword,
} from '@/components/auth/AdminRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import AdminChangePassword from '@/pages/AdminChangePassword';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminQuestions from '@/pages/AdminQuestions';
import AdminRoster from '@/pages/AdminRoster';
import AdminLogin from '@/pages/AdminLogin';
import Home from '@/pages/Home';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/admin" element={<AdminRoute />}>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<RequireChangePassword />}>
            <Route path="change-password" element={<AdminChangePassword />} />
          </Route>
          <Route element={<RequireAuthenticatedAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="questions" element={<AdminQuestions />} />
              <Route path="roster" element={<AdminRoster />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
