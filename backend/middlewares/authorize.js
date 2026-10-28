const authorize = (...roles) => (req, res, next) => { // use after authenticate: authorize("admin"), authorize("admin", "waiter")
  if (!roles.includes(req.user?.role)) {
    const err = new Error("You don't have permission for this action")
    err.status = 403 // logged in, but wrong role (401 would log the frontend out)
    err.code = "FORBIDDEN"
    throw err
  }
  next()
}

export default authorize
