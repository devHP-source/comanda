import jwt from "jsonwebtoken"
import User from "../models/User.js"
import httpError from "../utils/httpError.js"

const IMPERSONATION_EXPIRES_IN = "30m" // "View as" tokens are short-lived

// Payload kept small: authenticate reloads the user from the DB anyway
const signStaffToken = (user, { impersonatedBy, expiresIn = process.env.JWT_EXPIRES_IN || "1d" } = {}) =>
  jwt.sign(
    { id: user._id, kind: "staff", role: user.role, ...(impersonatedBy && { impersonatedBy }) }, // impersonatedBy (admin id) is only set on "View as" tokens
    process.env.JWT_SECRET,
    { expiresIn }
  )

export const login = async (req, res) => { // POST /api/auth/login (public, rate-limited)
  const { email, password } = req.body ?? {} // Express 5: no JSON body --> req.body is undefined

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    throw httpError(400, "MISSING_CREDENTIALS", "Email and password are required")
  }

  const user = await User.findOne({ email }).select("+password") // schema lowercase/trim also apply to the query

  if (!user || !user.isActive || !(await user.comparePassword(password))) {
    throw httpError(401, "INVALID_CREDENTIALS", "Invalid email or password") // same answer for unknown email, wrong password, Google-only or inactive account
  }

  res.json({
    token: signStaffToken(user),
    user,
  })
}

export const getMe = (req, res) => { // GET /api/auth/me (staff): req.user was loaded by authenticate
  res.json({ ...req.user.toJSON(), impersonatedBy: req.impersonatedBy }) // impersonatedBy: admin id while "View as" is on, else null --> the frontend can rebuild the banner after a reload
}

export const impersonate = async (req, res) => { // POST /api/auth/impersonate/:userId (admin): "View as" another staff account
  const target = await User.findById(req.params.userId) // bad id --> CastError --> 400 in errorHandler
  if (!target) throw httpError(404, "USER_NOT_FOUND", "User not found")

  // Admins can't be impersonated (yourself included): "View as" is only for testing the waiter and kitchen roles
  if (target.role === "admin") throw httpError(403, "CANNOT_IMPERSONATE_ADMIN", "Admins can't be impersonated")
  if (!target.isActive) throw httpError(400, "USER_INACTIVE", "User is inactive")

  const token = signStaffToken(target, { impersonatedBy: req.user._id, expiresIn: IMPERSONATION_EXPIRES_IN })
  const { exp } = jwt.decode(token) // seconds since 1970, set by expiresIn

  // Ids and names only: the server log never shows emails
  console.log(`[impersonate] admin ${req.user.name} (${req.user._id}) --> ${target.name} (${target._id}, ${target.role}) for ${IMPERSONATION_EXPIRES_IN}`)

  res.json({
    token,
    user: target,
    impersonatedBy: req.user._id,
    expiresAt: new Date(exp * 1000), // when the "View as" token stops working: after that, authenticate answers 401 TOKEN_EXPIRED
  })
}
