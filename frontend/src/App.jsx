import { Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import AdminLayout from './components/AdminLayout/AdminLayout.jsx'
import PublicLayout from './components/PublicLayout/PublicLayout.jsx'
import StaffLayout from './components/StaffLayout/StaffLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx'
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage/AdminCategoriesPage.jsx'
import AdminCategoryFormPage from './pages/admin/AdminCategoryFormPage/AdminCategoryFormPage.jsx'
import AdminDishFormPage from './pages/admin/AdminDishFormPage/AdminDishFormPage.jsx'
import AdminDishesPage from'./pages/admin/AdminDishesPage/AdminDishesPage.jsx'
import KitchenPage from './pages/kitchen/KitchenPage/KitchenPage.jsx'
import DishSheet from './pages/public/DishSheet/DishSheet.jsx'
import InfoPage from './pages/public/InfoPage/InfoPage.jsx'
import ListPage from './pages/public/ListPage/ListPage.jsx'
import MenuPage from './pages/public/MenuPage/MenuPage.jsx'
import NotFoundPage from './pages/public/NotFoundPage/NotFoundPage.jsx'
import StaffLoginPage from './pages/public/StaffLoginPage/StaffLoginPage.jsx'
import NewTicketPage from './pages/waiter/NewTicketPage/NewTicketPage.jsx'
import WaiterPage from './pages/waiter/WaiterPage/WaiterPage.jsx'
import toastStyle from './utils/toastStyle.js'

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
            <Route path="staff/kitchen" element={<KitchenPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dishes" replace />} />{/* until the Panoramica dashboard exists */}
            <Route path="dishes" element={<AdminDishesPage />} />
            <Route path="dishes/new" element={<AdminDishFormPage />} />
            <Route path="dishes/:id/edit" element={<AdminDishFormPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="categories/new" element={<AdminCategoryFormPage />} />
            <Route path="categories/:id/edit" element={<AdminCategoryFormPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>

    <Toaster position="top-center" toastOptions={{ style: toastStyle }} />
  </>
)

export default App
