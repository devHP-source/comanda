import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import AdminShellSkeleton from './components/AdminShellSkeleton/AdminShellSkeleton.jsx'
import PublicLayout from './components/PublicLayout/PublicLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx'
import StaffShellSkeleton from './components/StaffShellSkeleton/StaffShellSkeleton.jsx'
import BookingCancelPage from './pages/public/BookingCancelPage/BookingCancelPage.jsx'
import BookingConfirmPage from './pages/public/BookingConfirmPage/BookingConfirmPage.jsx'
import BookingPage from './pages/public/BookingPage/BookingPage.jsx'
import DishSheet from './pages/public/DishSheet/DishSheet.jsx'
import HomePage from './pages/public/HomePage/HomePage.jsx'
import InfoPage from './pages/public/InfoPage/InfoPage.jsx'
import ListPage from './pages/public/ListPage/ListPage.jsx'
import MenuPage from './pages/public/MenuPage/MenuPage.jsx'
import NotFoundPage from './pages/public/NotFoundPage/NotFoundPage.jsx'
import StaffLoginPage from './pages/public/StaffLoginPage/StaffLoginPage.jsx'
import toastStyle from './utils/toastStyle.js'

// Staff screens live in their own chunks, so guests never download them. The loaders are kept to fetch them all early on staff URLs
const staffLoaders = []
const lazyStaff = (load) => {
  staffLoaders.push(load)
  return lazy(load)
}

const StaffLayout = lazyStaff(() => import('./components/StaffLayout/StaffLayout.jsx'))
const WaiterPage = lazyStaff(() => import('./pages/waiter/WaiterPage/WaiterPage.jsx'))
const NewTicketPage = lazyStaff(() => import('./pages/waiter/NewTicketPage/NewTicketPage.jsx'))
const KitchenPage = lazyStaff(() => import('./pages/kitchen/KitchenPage/KitchenPage.jsx'))
const AdminLayout = lazyStaff(() => import('./components/AdminLayout/AdminLayout.jsx'))
const AdminDashboardPage = lazyStaff(() => import('./pages/admin/AdminDashboardPage/AdminDashboardPage.jsx'))
const AdminDishesPage = lazyStaff(() => import('./pages/admin/AdminDishesPage/AdminDishesPage.jsx'))
const AdminDishFormPage = lazyStaff(() => import('./pages/admin/AdminDishFormPage/AdminDishFormPage.jsx'))
const AdminCategoriesPage = lazyStaff(() => import('./pages/admin/AdminCategoriesPage/AdminCategoriesPage.jsx'))
const AdminCategoryFormPage = lazyStaff(() => import('./pages/admin/AdminCategoryFormPage/AdminCategoryFormPage.jsx'))
const AdminReservationsPage = lazyStaff(() => import('./pages/admin/AdminReservationsPage/AdminReservationsPage.jsx'))
const AdminQrPage = lazyStaff(() => import('./pages/admin/AdminQrPage/AdminQrPage.jsx'))
const AdminStaffPage = lazyStaff(() => import('./pages/admin/AdminStaffPage/AdminStaffPage.jsx'))
const AdminSettingsPage = lazyStaff(() => import('./pages/admin/AdminSettingsPage/AdminSettingsPage.jsx'))

const StaffScreenSkeleton = () => { // Suspense fallback
  const { pathname } = useLocation()
  return pathname.startsWith('/admin') ? <AdminShellSkeleton /> : <StaffShellSkeleton /> // same choice as ProtectedRoute
}

const App = () => {
  const { pathname } = useLocation()
  const isStaffUrl = pathname.startsWith('/staff') || pathname.startsWith('/admin')

  useEffect(() => { // On the login page or a staff reload, fetch every staff screen in the background: no wait after login, "View as" or a menu click
    if (!isStaffUrl) return
    staffLoaders.forEach((load) => load().catch(() => {})) // a failed fetch is retried when the screen is opened
  }, [isStaffUrl])

  return (
    <>
      <Suspense fallback={<StaffScreenSkeleton />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="menu" element={<MenuPage />}>
              <Route path="dish/:id" element={<DishSheet />} />
            </Route>
            <Route path="list" element={<ListPage />} />
            <Route path="book" element={<BookingPage />} />
            <Route path="book/confirm/:token" element={<BookingConfirmPage />} />
            <Route path="book/cancel/:token" element={<BookingCancelPage />} />
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
                <Route path="staff/kitchen" element={<KitchenPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="dishes" element={<AdminDishesPage />} />
                <Route path="dishes/new" element={<AdminDishFormPage />} />
                <Route path="dishes/:id/edit" element={<AdminDishFormPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="categories/new" element={<AdminCategoryFormPage />} />
                <Route path="categories/:id/edit" element={<AdminCategoryFormPage />} />
                <Route path="reservations" element={<AdminReservationsPage />} />
                <Route path="qr" element={<AdminQrPage />} />
                <Route path="staff" element={<AdminStaffPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>

      <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
    </>
  )
}

export default App
