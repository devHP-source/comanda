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

let unauthorizedHandler = clearToken // AuthContext registers what "logout" means (reset user, go to login); until then we only drop the token

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response, // Only a request that carried a token can end a session
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization)
    if (error.response?.status === 401 && sentToken) unauthorizedHandler(error) // a wrong password on login is a 401 too
    return Promise.reject(error)
  },
)
 
export const getErrorCode = (error) => { // Stable key for internationalization
  if (error.response) return error.response.data?.code || 'UNKNOWN_ERROR' // NETWORK_ERROR when the server never answered (offline, Render waking up)
  return 'NETWORK_ERROR'
}

export const getErrorMessage = (error) => error.response?.data?.message || error.message // English fallback for the toast when a code has no translation yet

export default api
