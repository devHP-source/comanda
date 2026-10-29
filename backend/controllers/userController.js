import User from "../models/User.js"

const maskEmail = (email) => { // "p***@gmail.com"
  const at = email.lastIndexOf("@")
  return `${email[0]}***${email.slice(at)}`
}


// Inactive users are included (isActive: false) so the switcher can show them greyed out; impersonate rejects them anyway.
export const getUsers = async (req, res) => { // GET /api/users (admin): every staff account, for the "View as" switcher. No pagination: staff come only from the seed (4 accounts).
  const [users, googleOnlyIds] = await Promise.all([
    User.find()
      .select("name email role avatar isActive") // password is select: false anyway; googleId stays private
      .sort({ role: 1, name: 1 }),
    User.distinct("_id", { password: { $in: [null, ""] } }), // filtering on password never loads the hashes
  ])

  const googleOnly = new Set(googleOnlyIds.map(String)) // Google-only accounts (no password, like the owner's personal Gmail) get a masked email here: only in this list, never in the DB or /auth/me
  res.json(users.map((user) => {
    const json = user.toJSON()
    if (googleOnly.has(String(user._id))) json.email = maskEmail(json.email)
    return json
  }))
}
