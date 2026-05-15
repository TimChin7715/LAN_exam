import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { AppRouter } from '@/router';

import './globals.css';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <AppRouter />
      <Toaster position="top-center" richColors closeButton />
    </AuthProvider>
  </StrictMode>,
);
