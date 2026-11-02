import { Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import PublicLayout from './components/PublicLayout/PublicLayout.jsx'
import StaffLayout from './components/StaffLayout/StaffLayout.jsx'
import NotFoundPage from './pages/public/NotFoundPage/NotFoundPage.jsx'

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
        <Route path="menu" />
        <Route path="list" />
        <Route path="info" />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<StaffLayout />}>
        <Route path="staff/waiter" />
        <Route path="staff/kitchen" />
      </Route>
    </Routes>

    <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
  </>
)

export default App
