import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { WorkoutProvider } from './contexts/WorkoutContext'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import WorkoutSessionPage from './pages/WorkoutSessionPage'
import TemplatesPage from './pages/TemplatesPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkoutProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Protected */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DashboardPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workout"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <WorkoutSessionPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <TemplatesPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </WorkoutProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
