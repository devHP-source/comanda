import "dotenv/config"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import mongoose from "mongoose"
import connectDB from "./config/db.js"
import notFound from "./middlewares/notFound.js"
import errorHandler from "./middlewares/errorHandler.js"
import categoryRoutes from "./routes/categoryRoutes.js"
import dishRoutes from "./routes/dishRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import settingsRoutes from "./routes/settingsRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import tableRoutes from "./routes/tableRoutes.js"
import reservationRoutes from "./routes/reservationRoutes.js"

const app = express()
const PORT = process.env.PORT || 9099

app.set("trust proxy", 1) // Render sits behind a proxy: the rate limit must read the real client IP

// Allow the deployed frontend + Vite dev server
const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:5173"].filter(Boolean)

app.use(helmet())
app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
// The verify and cancel tokens work like passwords: the request log shows "/verify/[token]" instead of the real one
morgan.token("url", (req) =>
  (req.originalUrl || req.url).replace(/^(\/api\/reservations\/(?:verify|cancel)\/)[^/?#]+/, "$1[token]")
)
app.use(morgan("dev"))

app.get("/api/health", (req, res) => { // health check: a first request also wakes Render from sleep
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  })
})

app.use("/api/auth", authRoutes)
app.use("/api/categories", categoryRoutes)
app.use("/api/dishes", dishRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/users", userRoutes)
app.use("/api/settings", settingsRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/tables", tableRoutes)
app.use("/api/reservations", reservationRoutes)

app.use(notFound)
app.use(errorHandler)

if (!process.env.JWT_SECRET) { // fail at startup, not with a 500 on the first login
  console.error("Missing JWT_SECRET in .env")
  process.exit(1)
}

try {
  await connectDB()
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
} catch (err) {
  console.error("MongoDB connection failed:", err.message)
  process.exit(1)
}
