import { Router } from "express"
import { cancelReservation, createReservation, getReservations, getSlots, updateReservationStatus, verifyReservation } from "../controllers/reservationController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"
import { reservationLimiter } from "../middlewares/rateLimit.js"

const router = Router()

router.get("/slots", getSlots)
router.get("/verify/:token", verifyReservation)
router.post("/", reservationLimiter, createReservation)
router.post("/cancel/:token", cancelReservation)

router.get("/", authenticate, authorize("admin", "waiter"), getReservations) // what each role sees: filter in the controller
router.patch("/:id/status", authenticate, authorize("admin"), updateReservationStatus)

export default router
