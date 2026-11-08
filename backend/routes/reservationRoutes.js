import { Router } from "express"
import { createReservation, getSlots } from "../controllers/reservationController.js"
import { reservationLimiter } from "../middlewares/rateLimit.js"

const router = Router()

router.get("/slots", getSlots)
router.post("/", reservationLimiter, createReservation)

export default router
