import { Router } from "express"
import { createOrder } from "../controllers/orderController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.post("/", authenticate, authorize("admin", "waiter"), createOrder) // the kitchen only moves tickets, it never creates them

export default router
