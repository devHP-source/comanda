import jwt from "jsonwebtoken"
import User from "../models/User.js"

const authError = (message, code) => { // every auth failure is a 401: the frontend logs out on 401
  const err = new Error(message)
  err.status = 401
  err.code = code
  return err
}

const authenticate = async (req, res, next) => { // staff only: reads "Authorization: Bearer <token>"
  const header = req.headers.authorization || ""
  const [scheme, token] = header.split(" ")

  if (scheme !== "Bearer" || !token) {
    throw authError("Missing or malformed Authorization header", "NO_TOKEN")
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }) // only the algorithm we sign with
  } catch (err) {
    if (err.name === "TokenExpiredError") throw authError("Token expired", "TOKEN_EXPIRED")
    throw authError("Invalid token", "INVALID_TOKEN") // bad signature, garbage, wrong algorithm
  }

  if (payload.kind !== "staff") { // a customer token can never reach staff routes
    throw authError("Invalid token", "INVALID_TOKEN")
  }

  // Loaded from the DB on every request: role changes and deactivation apply at once, not when the token expires
  const user = await User.findById(payload.id)
  if (!user) throw authError("User no longer exists", "INVALID_TOKEN")
  if (!user.isActive) throw authError("Account disabled", "ACCOUNT_DISABLED")


  if (payload.impersonatedBy) { // "View as" token: the admin who started it must still be an active admin, or the token dies with them
    const admin = await User.findById(payload.impersonatedBy)
    if (!admin || !admin.isActive || admin.role !== "admin") {
      throw authError("Impersonation no longer allowed", "INVALID_TOKEN")
    }
  }

  req.user = user
  req.impersonatedBy = payload.impersonatedBy ?? null // admin id while "View as" is on
  next()
}

export default authenticate
