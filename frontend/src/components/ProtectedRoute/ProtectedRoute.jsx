import { Navigate, Outlet, useLocation } from 'react-router'
import AdminShellSkeleton from '../AdminShellSkeleton/AdminShellSkeleton.jsx'
import StaffShellSkeleton from '../StaffShellSkeleton/StaffShellSkeleton.jsx'
import useAuth from '../../hooks/useAuth.js'
import roleHome from '../../utils/roleHome.js'


const ProtectedRoute = ({ roles }) => {
  const { user, isChecking } = useAuth() // The UI check only the backend authorize() enforces the same roles anyway
  const location = useLocation()

  if (isChecking) return location.pathname.startsWith('/admin') ? <AdminShellSkeleton /> : <StaffShellSkeleton /> // the frame of the page that's coming

  if (!user) return <Navigate to="/staff/login" replace state={{ from: location.pathname }} /> // back here after login
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace /> // wrong interface? go to your own

  return <Outlet />
}

export default ProtectedRoute
