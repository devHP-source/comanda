import { Router } from "express"
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.get("/", getCategories)
router.post("/", authenticate, authorize("admin"), createCategory)
router.put("/:id", authenticate, authorize("admin"), updateCategory)
router.delete("/:id", authenticate, authorize("admin"), deleteCategory)

export default router
