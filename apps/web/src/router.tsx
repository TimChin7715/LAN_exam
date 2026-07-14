import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import {
  AdminRoute,
  RequireAuthenticatedAdmin,
  RequireChangePassword,
} from '@/components/auth/AdminRoute';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { isAdminAuthDisabled } from '@/lib/admin-auth';
import AdminChangePassword from '@/pages/AdminChangePassword';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminQuestions from '@/pages/AdminQuestions';
import AdminQuestionBankDetail from '@/pages/AdminQuestionBankDetail';
import AdminRoster from '@/pages/AdminRoster';
import AdminRosterBatchDetail from '@/pages/AdminRosterBatchDetail';
import AdminExams from '@/pages/AdminExams';
import AdminExamDetail from '@/pages/AdminExamDetail';
import AdminSettings from '@/pages/AdminSettings';
import { StudentRoute } from '@/components/auth/StudentRoute';
import { StudentExamErrorBoundary } from '@/components/student/StudentExamErrorBoundary';
import StudentExamEnded from '@/pages/StudentExamEnded';
import StudentExamSubmitted from '@/pages/StudentExamSubmitted';
import StudentExamTake from '@/pages/StudentExamTake';
import AdminLogin from '@/pages/AdminLogin';
import Home from '@/pages/Home';
import StudentLogin from '@/pages/StudentLogin';
import StudentWaiting from '@/pages/StudentWaiting';

const adminAppRoutes = (
  <Route element={<AdminLayout />}>
    <Route index element={<AdminDashboard />} />
    <Route path="dashboard" element={<AdminDashboard />} />
    <Route path="questions" element={<AdminQuestions />} />
    <Route path="questions/:batchId" element={<AdminQuestionBankDetail />} />
    <Route path="roster" element={<AdminRoster />} />
    <Route path="roster/:batchId" element={<AdminRosterBatchDetail />} />
    <Route path="exams" element={<AdminExams />} />
    <Route path="exams/:examId" element={<AdminExamDetail />} />
    <Route path="settings" element={<AdminSettings />} />
  </Route>
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/exam" element={<StudentRoute />}>
          <Route path="login" element={<StudentLogin />} />
          <Route path="waiting" element={<StudentWaiting />} />
          <Route path="take" element={<StudentExamErrorBoundary><StudentExamTake /></StudentExamErrorBoundary>} />
          <Route path="submitted" element={<StudentExamErrorBoundary><StudentExamSubmitted /></StudentExamErrorBoundary>} />
          <Route path="ended" element={<StudentExamErrorBoundary><StudentExamEnded /></StudentExamErrorBoundary>} />
        </Route>

        <Route path="/admin" element={<AdminRoute />}>
          {isAdminAuthDisabled ? (
            adminAppRoutes
          ) : (
            <>
              <Route path="login" element={<AdminLogin />} />
              <Route element={<RequireChangePassword />}>
                <Route path="change-password" element={<AdminChangePassword />} />
              </Route>
              <Route element={<RequireAuthenticatedAdmin />}>{adminAppRoutes}</Route>
            </>
          )}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
