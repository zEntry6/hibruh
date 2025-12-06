// frontend/src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import { useAuth } from './context/AuthContext.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ModerationPage from './pages/ModerationPage.jsx';

const App = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* root: otomatis pilih auth atau app */}
      <Route
        path="/"
        element={
          user ? <Navigate to="/app" replace /> : <Navigate to="/auth" replace />
        }
      />

      {/* kalau user sudah login dan buka /auth, langsung lempar ke /app */}
      <Route
        path="/auth"
        element={user ? <Navigate to="/app" replace /> : <AuthPage />}
      />

      {/* halaman utama chat */}
      <Route
        path="/app"
        element={user ? <ChatPage /> : <Navigate to="/auth" replace />}
      />

      <Route
        path="/moderation"
        element={
          user ? <ModerationPage /> : <Navigate to="/auth" replace />
        }
      />

      {/* halaman reset password */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
