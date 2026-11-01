import { Router } from "express"
import { createOrder, getOrders, updateOrderStatus } from "../controllers/orderController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.get("/", authenticate, authorize("admin", "waiter", "kitchen"), getOrders)
router.post("/", authenticate, authorize("admin", "waiter"), createOrder) // the kitchen only moves tickets, it never creates them
router.patch("/:id/status", authenticate, authorize("admin", "waiter", "kitchen"), updateOrderStatus) // which role sets which status: TRANSITIONS in the controller

export default router
