import httpError from "../utils/httpError.js"

const authorize = (...roles) => (req, res, next) => { // use after authenticate: authorize("admin"), authorize("admin", "waiter")
  if (!roles.includes(req.user?.role)) {
    throw httpError(403, "FORBIDDEN", "You don't have permission for this action") // logged in, but wrong role (401 would log the frontend out)
  }
  next()
}

export default authorize
