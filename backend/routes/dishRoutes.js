import { Router } from "express"
import {
  getDishes,
  getDishById,
  createDish,
  updateDish,
  updateAvailability,
  deleteDish,
} from "../controllers/dishController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"
import { uploadDishImage } from "../middlewares/upload.js"

const router = Router()

router.get("/", getDishes)
router.get("/:id", getDishById)
router.post("/", authenticate, authorize("admin"), uploadDishImage, createDish) // multer after the role check: guests can't upload files

router.put("/:id", authenticate, authorize("admin"), updateDish)
router.patch("/:id/availability", authenticate, authorize("admin", "waiter", "kitchen"), updateAvailability)
router.delete("/:id", authenticate, authorize("admin"), deleteDish)

export default router
