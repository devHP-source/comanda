/*
* Run from backend/ by:
* npm run seed 
*/
import "dotenv/config"
import { readFile } from "node:fs/promises"
import mongoose from "mongoose"
import connectDB from "../config/db.js"
import Category from "../models/Category.js"
import Dish from "../models/Dish.js"
import User from "../models/User.js"

async function readJson(fileName) {
  const text = await readFile(new URL(fileName, import.meta.url), "utf-8")
  return JSON.parse(text)
}

function requireEnv(name) { // demo credentials come only from .env, never hardcoded
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name} in .env`)
  }
  return value
}

function getStaffData() {
  return [
    { 
      name: "Admin", 
      email: requireEnv("SEED_ADMIN_EMAIL"), 
      password: requireEnv("SEED_ADMIN_PASSWORD"), 
      role: "admin" 
    },
    { 
      name: "Cameriere", 
      email: requireEnv("SEED_WAITER_EMAIL"), 
      password: requireEnv("SEED_WAITER_PASSWORD"), 
      role: "waiter" 
    },
    { 
      name: "Cucina", 
      email: requireEnv("SEED_KITCHEN_EMAIL"), 
      password: requireEnv("SEED_KITCHEN_PASSWORD"), 
      role: "kitchen" 
    },
    { 
      name: "Titolare", // Google-only owner: no password
      email: requireEnv("SEED_OWNER_GOOGLE_EMAIL"), 
      role: "admin" 
    }, 
  ]
}

async function seed() {
  const categoriesData = await readJson("./categories.json")
  const dishesData = await readJson("./dishes.json")
  const staffData = getStaffData() // check .env before deleting anything

  await connectDB()
  await Promise.all([Category.init(), Dish.init(), User.init()]) // wait for the unique indexes (code, name.it, email) before inserting

  await Dish.deleteMany()
  await Category.deleteMany()
  await User.deleteMany() // staff accounts come only from the seed

  const users = await User.create(staffData) // create(), not insertMany(): runs pre('save') so passwords get hashed
  console.log(`Inserted ${users.length} staff users (${users.map((user) => user.role).join(", ")})`)

  const categories = await Category.insertMany(categoriesData)
  console.log(`Inserted ${categories.length} categories`)

  const categoryIds = {}  // dishes.json links each dish to its category by Italian name --> swap the name for the _id
  for (const category of categories) {
    categoryIds[category.name.it] = category._id
  }

  const dishes = dishesData.map((dish) => {
    const categoryId = categoryIds[dish.category]
    if (!categoryId) {
      throw new Error(`Dish ${dish.code}: unknown category "${dish.category}"`)
    }
    return { ...dish, price: Math.round(dish.price * 100), category: categoryId } // dishes.json holds euros (8.5), the DB stores cents (850)
  })

  const insertedDishes = await Dish.insertMany(dishes)
  console.log(`Inserted ${insertedDishes.length} dishes`)
}

try {
  await seed()
  console.log("Seed completed")
} catch (err) {
  console.error("Seed failed:", err.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
