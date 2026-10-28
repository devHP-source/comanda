import { Router } from "express"
import { login, getMe } from "../controllers/authController.js"
import { loginLimiter } from "../middlewares/rateLimit.js"
import authenticate from "../middlewares/authenticate.js"

const router = Router()

router.post("/login", loginLimiter, login)
router.get("/me", authenticate, getMe)

export default router
