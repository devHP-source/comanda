import { Router } from "express"
import { cancelReservation, createReservation, getSlots, verifyReservation } from "../controllers/reservationController.js"
import { reservationLimiter } from "../middlewares/rateLimit.js"

const router = Router()

router.get("/slots", getSlots)
router.get("/verify/:token", verifyReservation)
router.post("/", reservationLimiter, createReservation)
router.post("/cancel/:token", cancelReservation)

export default router
