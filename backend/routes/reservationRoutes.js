import { Router } from "express"
import { getSlots } from "../controllers/reservationController.js"

const router = Router()

router.get("/slots", getSlots)

export default router
