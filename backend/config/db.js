import mongoose from "mongoose"

export default async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in .env")
  }

  const conn = await mongoose.connect(process.env.MONGODB_URI)
  console.log(`MongoDB connected: ${conn.connection.name}`)
}
