import { useCallback, useEffect, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { toast } from 'sonner'
import { AuthContext } from './AuthContext.js'
import api, {
  clearAdminSession,
  clearToken,
  getAdminSession,
  getToken,
  setAdminSession,
  setToken,
  setUnauthorizedHandler,
} from '../api/client.js'
import useLanguage from '../hooks/useLanguage.js'

const hasUsableToken = () => { // Reads the stored token without trusting it, only kind and expiry, the server still checks the signature on /me
  const token = getToken()
  if (!token) return false
  if (getAdminSession()) return true // "View as" on: even an expired token goes to /me, whose 401 brings the admin back

  try {
    const { kind, exp } = jwtDecode(token)
    if (kind === 'staff' && exp * 1000 > Date.now()) return true
  } catch {
    // not a valid JWT: dropped below, like an expired one
  }

  clearToken() // expired or broken, no need to ask the server
  return false
}

export const AuthProvider = ({ children }) => {
  const { t, tError } = useLanguage()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (hasUsableToken() ? 'checking' : 'ready')) // checking = /me still running after a reload

  const logout = useCallback(() => {
    clearToken()
    clearAdminSession() // also while "View as" is on: no admin token stays behind
    setUser(null)
  }, [])

  const stopViewAs = useCallback(() => { // "Torna admin": the admin's token and profile come back, no backend call. ProtectedRoute redirects
    const admin = getAdminSession()
    if (!admin) {
      logout() // nothing to go back to
      return
    }
    clearAdminSession()
    setToken(admin.token)
    setUser(admin.user)
  }, [logout])

  useEffect(() => { // A token saved before the reload: /me loads the user again (role, active, impersonatedBy)
    if (status !== 'checking') return
    let ignore = false // StrictMode runs effects twice in dev

    api.get('/auth/me')
      .then(({ data }) => {
        if (!ignore) setUser(data)
      })
      .catch((error) => {
        if (!ignore && !error.response) toast.error(tError(error)) // a 401 is already handled below
      })
      .finally(() => {
        if (!ignore) setStatus('ready')
      })

    return () => {
      ignore = true
    }
  }, [status, tError])

  useEffect(() => { // Any 401 on the token in use, drop the session, ProtectedRoute sends the user to the login page
    setUnauthorizedHandler((error) => {
      if (getAdminSession()) { // the 30 minutes of "View as" ran out: back to the admin, not to the login page
        stopViewAs()
        toast.info(t('viewAs.expired'))
        return
      }
      clearToken()
      setUser(null)
      toast.error(tError(error), { id: 'session-ended' }) // polling can fire many 401s at once: one toast
    })
    return () => setUnauthorizedHandler(clearToken)
  }, [t, tError, stopViewAs])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    clearAdminSession() // a leftover must never turn this account's 401 into an admin session
    setToken(data.token)

    try {
      const { data: me } = await api.get('/auth/me')
      setUser(me)
      return me
    } catch (error) {
      clearToken()
      throw error
    }
  }, [])

  const startViewAs = useCallback(async (userId) => { // Admin only: the server signs a 30-minute token for that account. ProtectedRoute redirects to that role's screen
    const { data } = await api.post(`/auth/impersonate/${userId}`)
    setAdminSession({ token: getToken(), user })
    setToken(data.token)
    setUser({ ...data.user, impersonatedBy: data.impersonatedBy }) // same shape as /me
  }, [user])

  const value = useMemo(
    () => ({ user, isChecking: status === 'checking', login, logout, startViewAs, stopViewAs }),
    [user, status, login, logout, startViewAs, stopViewAs],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
