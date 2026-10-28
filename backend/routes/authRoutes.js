import { Router } from "express"
import { login } from "../controllers/authController.js"
import { loginLimiter } from "../middlewares/rateLimit.js"

const router = Router()

router.post("/login", loginLimiter, login)

export default router
