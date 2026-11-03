import { Navigate, Outlet, useLocation } from 'react-router'
import LoadingState from '../LoadingState/LoadingState.jsx'
import useAuth from '../../hooks/useAuth.js'
import roleHome from '../../utils/roleHome.js'
import styles from './ProtectedRoute.module.css'


const ProtectedRoute = ({ roles }) => {
  const { user, isChecking } = useAuth() // The UI check only the backend authorize() enforces the same roles anyway
  const location = useLocation()

  if (isChecking) {
    return (
      <div className={styles.checking}>
        <LoadingState slowMessage="auth.checkingSlow" />
      </div>
    )
  }

  if (!user) return <Navigate to="/staff/login" replace state={{ from: location.pathname }} /> // back here after login
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace /> // wrong interface? go to your own

  return <Outlet />
}

export default ProtectedRoute
