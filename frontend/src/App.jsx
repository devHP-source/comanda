import { Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import PublicLayout from './components/PublicLayout/PublicLayout.jsx'
import StaffLayout from './components/StaffLayout/StaffLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx'
import MenuPage from './pages/public/MenuPage/MenuPage.jsx'
import NotFoundPage from './pages/public/NotFoundPage/NotFoundPage.jsx'
import StaffLoginPage from './pages/public/StaffLoginPage/StaffLoginPage.jsx'

const toastStyle = {
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--color-ink)',
  background: 'var(--color-surface)',
  boxShadow: 'var(--shadow-float)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm)',
}

const App = () => (
  <>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Navigate to="/menu" replace />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="list" />
        <Route path="info" />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="staff/login" element={<StaffLoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<StaffLayout />}>
          {/* One interface per duty: admin reaches the others through "View as" */}
          <Route element={<ProtectedRoute roles={['waiter']} />}>
            <Route path="staff/waiter" />
          </Route>
          <Route element={<ProtectedRoute roles={['kitchen']} />}>
            <Route path="staff/kitchen" />
          </Route>
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="admin" />
          </Route>
        </Route>
      </Route>
    </Routes>

    <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
  </>
)

export default App
