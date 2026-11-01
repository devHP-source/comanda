import { Router } from "express"
import { closeTable, getTables } from "../controllers/tableController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.get("/", authenticate, authorize("admin", "waiter"), getTables)
router.post("/:number/close", authenticate, authorize("admin", "waiter"), closeTable) // the kitchen never closes a table

export default router
