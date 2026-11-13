import mongoose from "mongoose"

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in .env")
  }

  // Blocks operator injection ({ "$ne": null } in a body): every { $op } in a filter is wrapped in $eq, except values wrapped in mongoose.trusted() (our own operators)
  mongoose.set("sanitizeFilter", true)

  const conn = await mongoose.connect(process.env.MONGODB_URI)
  console.log(`MongoDB connected: ${conn.connection.name}`)
}

export default connectDB
