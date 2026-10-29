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

const app = express()
const PORT = process.env.PORT || 9099

app.set("trust proxy", 1) // Render sits behind a proxy: the rate limit must read the real client IP

// Allow the deployed frontend + Vite dev server
const allowedOrigins = [process.env.FRONTEND_URL, "http://localhost:5173"].filter(Boolean)

app.use(helmet())
app.use(cors({ 
  origin: allowedOrigins 
}))
app.use(express.json())
app.use(morgan("dev"))


app.get("/api/health", (req, res) => { // Health check per svegliare Render dallo sleep
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  })
})

app.use("/api/auth", authRoutes)
app.use("/api/categories", categoryRoutes)
app.use("/api/dishes", dishRoutes)
app.use("/api/admin", adminRoutes)

app.use(notFound)
app.use(errorHandler)

try {
  await connectDB()
  app.listen(PORT, () => console.log(`Server listening on port ${PORT}`))
} catch (err) {
  console.error("MongoDB connection failed:", err.message)
  process.exit(1)
}
