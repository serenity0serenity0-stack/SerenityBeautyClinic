import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useTheme } from './hooks/useTheme'
import { useLanguage } from './hooks/useLanguage'
import { useAuth } from './hooks/useAuth'
import { AuthProvider } from './contexts/AuthContext'
import { canAccess, firstAllowedPage, ROUTE_TO_PAGE } from './lib/permissions'

// Pages
import Login from './pages/Login'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { POS } from './pages/POS'
import { Clients } from './pages/Clients'
import { Services } from './pages/Services'
import { Expenses } from './pages/Expenses'
import { Analytics } from './pages/Analytics'
import { Settings } from './pages/Settings'
import { DailyLogs } from './pages/DailyLogs'
import { Staff } from './pages/Staff'
import { Bookings } from './pages/Bookings'
import { QueueDisplay } from './pages/QueueDisplay'

/**
 * ProtectedRoute Component
 * 
 * Requires login. Cashiers can only open pages they were granted by the admin.
 * Admins can access everything.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, role, permissions } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen app-shell flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-hot-pink/20 border-t-hot-pink animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!role) {
    return <Navigate to="/login" replace />
  }

  // Enforce per-page permissions for cashiers
  const required = ROUTE_TO_PAGE[location.pathname]
  if (required && !canAccess(role, permissions, required)) {
    const target = firstAllowedPage(role, permissions)
    return <Navigate to={target} replace />
  }

  return <>{children}</>
}

function App() {
  const { theme } = useTheme()
  const { language } = useLanguage()

  // Update document attributes for theme and language
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [language, theme])

  return (
    <div className={theme === 'dark' ? 'dark' : 'light'}>
      <AuthProvider>
        <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Clinic Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <Layout>
                  <POS />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <Layout>
                  <Clients />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <Layout>
                  <Staff />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Bookings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/queue"
            element={
              <ProtectedRoute>
                <Layout>
                  <QueueDisplay />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/services"
            element={
              <ProtectedRoute>
                <Layout>
                  <Services />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <Layout>
                  <DailyLogs />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Layout>
                  <Expenses />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Layout>
                  <Analytics />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Router>
      </AuthProvider>
      <Toaster position="bottom-center" />
    </div>
  )
}

export default App
