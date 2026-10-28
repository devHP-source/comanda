import jwt from "jsonwebtoken"
import User from "../models/User.js"

const signStaffToken = (user) => // payload kept small: authenticate reloads the user from the DB anyway
  jwt.sign(
    { id: user._id, kind: "staff", role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
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
  res.json(req.user)
}
