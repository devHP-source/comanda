import { useCallback, useEffect, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { toast } from 'sonner'
import { AuthContext } from './AuthContext.js'
import api, { clearToken, getToken, setToken, setUnauthorizedHandler } from '../api/client.js'
import useLanguage from '../hooks/useLanguage.js'

const hasUsableToken = () => { // Reads the stored token without trusting it, only kind and expiry, the server still checks the signature on /me
  const token = getToken()
  if (!token) return false

  try {
    const { kind, exp } = jwtDecode(token)
    if (kind === 'staff' && exp * 1000 > Date.now()) return true
  } catch {
    
  }

  clearToken() // expired or broken, no need to ask the server
  return false
}

export const AuthProvider = ({ children }) => {
  const { tError } = useLanguage()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (hasUsableToken() ? 'checking' : 'ready')) // checking = /me still running after a reload


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


  useEffect(() => { // Any 401 on a request that carried a token, drop the session, ProtectedRoute sends the user to the login page
    setUnauthorizedHandler((error) => {
      clearToken()
      setUser(null)
      toast.error(tError(error), { id: 'session-ended' }) // polling can fire many 401s at once: one toast
    })
    return () => setUnauthorizedHandler(clearToken)
  }, [tError])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
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

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, isChecking: status === 'checking', login, logout }),
    [user, status, login, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
