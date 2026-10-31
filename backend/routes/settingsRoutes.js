import { Router } from "express"
import { getAllSettings, getPublicSettings, updateSettings } from "../controllers/settingsController.js"
import authenticate from "../middlewares/authenticate.js"
import authorize from "../middlewares/authorize.js"

const router = Router()

router.get("/public", getPublicSettings)
router.get("/", authenticate, authorize("admin"), getAllSettings)
router.put("/", authenticate, authorize("admin"), updateSettings)

export default router
