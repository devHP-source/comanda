import jwt from "jsonwebtoken"
import User from "../models/User.js"

const IMPERSONATION_EXPIRES_IN = "30m" // "View as" tokens are short-lived


const signStaffToken = (user, { impersonatedBy, expiresIn = process.env.JWT_EXPIRES_IN || "1d" } = {}) => // Payload kept small: authenticate reloads the user from the DB anyway.
  jwt.sign(
    { id: user._id, kind: "staff", role: user.role, ...(impersonatedBy && { impersonatedBy }) }, // impersonatedBy (admin id) is only set on "View as" tokens
    process.env.JWT_SECRET,
    { expiresIn }
  )

export const login = async (req, res) => { // POST /api/auth/login (public, rate-limited)
  const { email, password } = req.body ?? {} // Express 5: no JSON body --> req.body is undefined

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    const err = new Error("Email and password are required")
    err.status = 400
    err.code = "MISSING_CREDENTIALS"
    throw err
  }

  const user = await User.findOne({ email }).select("+password") // schema lowercase/trim also apply to the query

  if (!user || !user.isActive || !(await user.comparePassword(password))) {
    const err = new Error("Invalid email or password")
    err.status = 401
    err.code = "INVALID_CREDENTIALS" // Same answer for unknown email, wrong password, Google-only or inactive account
    throw err
  }

  res.json({
    token: signStaffToken(user),
    user,
  })
}

export const getMe = (req, res) => { // GET /api/auth/me (staff): req.user was loaded by authenticate
  res.json({ ...req.user.toJSON(), impersonatedBy: req.impersonatedBy }) // impersonatedBy: admin id while "View as" is on, else null --> the frontend can rebuild the banner after a reload
}

const impersonateError = (status, message, code) => {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

export const impersonate = async (req, res) => { // POST /api/auth/impersonate/:userId (admin): "View as" another staff account
  const target = await User.findById(req.params.userId) // bad id --> CastError --> 400 in errorHandler
  if (!target) throw impersonateError(404, "User not found", "USER_NOT_FOUND")

  // Admins can't be impersonated (yourself included): "View as" is only for testing the waiter and kitchen roles
  if (target.role === "admin") throw impersonateError(403, "Admins can't be impersonated", "CANNOT_IMPERSONATE_ADMIN")
  if (!target.isActive) throw impersonateError(400, "User is inactive", "USER_INACTIVE")

  const token = signStaffToken(target, { impersonatedBy: req.user._id, expiresIn: IMPERSONATION_EXPIRES_IN })
  const { exp } = jwt.decode(token) // seconds since 1970, set by expiresIn

  // Ids and names only: the server log never shows emails
  console.log(`[impersonate] admin ${req.user.name} (${req.user._id}) --> ${target.name} (${target._id}, ${target.role}) for ${IMPERSONATION_EXPIRES_IN}`)

  res.json({
    token,
    user: target,
    impersonatedBy: req.user._id,
    expiresAt: new Date(exp * 1000), // the frontend can go back to the admin token when it runs out
  })
}
