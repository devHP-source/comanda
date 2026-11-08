import axios from 'axios'

const TOKEN_KEY = 'comanda_token'

export const getToken = () => { // localStorage can throw
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const setToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // the session lasts until the page is reloaded
  }
}

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // nothing to clear
  }
}

const ADMIN_SESSION_KEY = 'comanda_admin_session'

export const getAdminSession = () => { // "View as": the admin's { token, user }, kept aside until "Torna admin"
  try {
    return JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY))
  } catch {
    return null
  }
}

export const setAdminSession = (session) => {
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
  } catch {
    // storage unavailable: "Torna admin" ends in the login page
  }
}

export const clearAdminSession = () => {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY)
  } catch {
    // nothing to clear
  }
}

let unauthorizedHandler = clearToken // AuthContext registers what "logout" means (reset user, go to login); until then we only drop the token

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}` // a request may bring its own (kitchen undo: the token of the tap)
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => { // Only the token in use can end a session: a wrong password on login carries none, and a late answer for a token "View as" already replaced must not touch the new one
    const sentAuthorization = error.config?.headers?.Authorization
    if (error.response?.status === 401 && sentAuthorization === `Bearer ${getToken()}`) unauthorizedHandler(error)
    return Promise.reject(error)
  },
)
 
export const getErrorCode = (error) => { // Stable key for internationalization
  if (error.response) return error.response.data?.code || 'UNKNOWN_ERROR' // NETWORK_ERROR when the server never answered (offline, Render waking up)
  return 'NETWORK_ERROR'
}

export const getErrorMessage = (error) => error.response?.data?.message || error.message // English fallback for the toast when a code has no translation yet

export default api
