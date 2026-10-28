import { Router } from "express"
import { getDishes, getDishById } from "../controllers/dishController.js"

const router = Router()

router.get("/", getDishes)
router.get("/:id", getDishById)

export default router
