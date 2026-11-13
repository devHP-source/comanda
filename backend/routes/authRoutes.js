import { Router } from "express"
import { login, getMe, impersonate } from "../controllers/authController.js"
import { loginLimiter } from "../middlewares/rateLimit.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.post("/login", loginLimiter, login)
router.get("/me", authenticate, getMe)
// A "View as" token belongs to a waiter or kitchen user: authorize("admin") also stops it from impersonating again
router.post("/impersonate/:userId", authenticate, authorize("admin"), impersonate)

export default router
