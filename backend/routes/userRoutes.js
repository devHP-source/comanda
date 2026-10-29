import { Router } from "express"
import { getUsers } from "../controllers/userController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.get("/", authenticate, authorize("admin"), getUsers)

export default router
