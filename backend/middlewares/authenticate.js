import jwt from "jsonwebtoken"
import User from "../models/User.js"
import httpError from "../utils/httpError.js"

const authError = (code, message) => httpError(401, code, message) // every auth failure is a 401: the frontend logs out on 401

const authenticate = async (req, res, next) => { // staff only: reads "Authorization: Bearer <token>"
  const header = req.headers.authorization || ""
  const [scheme, token] = header.split(" ")

  if (scheme !== "Bearer" || !token) {
    throw authError("NO_TOKEN", "Missing or malformed Authorization header")
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }) // only the algorithm we sign with
  } catch (err) {
    if (err.name === "TokenExpiredError") throw authError("TOKEN_EXPIRED", "Token expired")
    throw authError("INVALID_TOKEN", "Invalid token") // bad signature, garbage, wrong algorithm
  }

  if (payload.kind !== "staff") { // a customer token can never reach staff routes
    throw authError("INVALID_TOKEN", "Invalid token")
  }

  // Loaded from the DB on every request: role changes and deactivation apply at once, not when the token expires
  const user = await User.findById(payload.id)
  if (!user) throw authError("INVALID_TOKEN", "User no longer exists")
  if (!user.isActive) throw authError("ACCOUNT_DISABLED", "Account disabled")

  if (payload.impersonatedBy) { // "View as" token: the admin who started it must still be an active admin, or the token dies with them
    const admin = await User.findById(payload.impersonatedBy)
    if (!admin || !admin.isActive || admin.role !== "admin") {
      throw authError("INVALID_TOKEN", "Impersonation no longer allowed")
    }
  }

  req.user = user
  req.impersonatedBy = payload.impersonatedBy ?? null // admin id while "View as" is on
  next()
}

export default authenticate
