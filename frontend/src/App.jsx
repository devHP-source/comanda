import { Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import PublicLayout from './components/PublicLayout/PublicLayout.jsx'
import StaffLayout from './components/StaffLayout/StaffLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx'
import DishSheet from './pages/public/DishSheet/DishSheet.jsx'
import InfoPage from './pages/public/InfoPage/InfoPage.jsx'
import ListPage from './pages/public/ListPage/ListPage.jsx'
import MenuPage from './pages/public/MenuPage/MenuPage.jsx'
import NotFoundPage from './pages/public/NotFoundPage/NotFoundPage.jsx'
import StaffLoginPage from './pages/public/StaffLoginPage/StaffLoginPage.jsx'
import NewTicketPage from './pages/waiter/NewTicketPage/NewTicketPage.jsx'
import WaiterPage from './pages/waiter/WaiterPage/WaiterPage.jsx'

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
        <Route path="menu" element={<MenuPage />}>
          <Route path="dish/:id" element={<DishSheet />} />
        </Route>
        <Route path="list" element={<ListPage />} />
        <Route path="info" element={<InfoPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="staff/login" element={<StaffLoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<StaffLayout />}>
          <Route element={<ProtectedRoute roles={['waiter']} />}>
            <Route path="staff/waiter" element={<WaiterPage />} />
            <Route path="staff/waiter/tables/:number/new" element={<NewTicketPage />} />
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
