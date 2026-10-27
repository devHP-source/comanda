import mongoose from "mongoose"

export default async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in .env")
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log("MongoDB connected")
}
