import { Router } from "express"
import { getAdminDishes, getAdminDishById } from "../controllers/dishController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.use(authenticate, authorize("admin")) // every /api/admin route is admin only

router.get("/dishes", getAdminDishes)
router.get("/dishes/:id", getAdminDishById)

export default router
