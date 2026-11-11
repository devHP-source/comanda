import { Router } from "express"
import { cancelReservation, createReservation, getCancelDetails, getReservationFreeTables, getReservations, getSlots, updateReservationStatus, verifyReservation } from "../controllers/reservationController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"
import { reservationLimiter } from "../middlewares/rateLimit.js"

const router = Router()

router.get("/slots", getSlots)
router.get("/verify/:token", verifyReservation)
router.post("/", reservationLimiter, createReservation)
router.get("/cancel/:token", getCancelDetails)
router.post("/cancel/:token", cancelReservation)

router.get("/", authenticate, authorize("admin", "waiter"), getReservations) // what each role sees: filter in the controller
router.get("/:id/free-tables", authenticate, authorize("admin"), getReservationFreeTables)
router.patch("/:id/status", authenticate, authorize("admin"), updateReservationStatus)

export default router
