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

async function readJson(fileName) {
  const text = await readFile(new URL(fileName, import.meta.url), "utf-8")
  return JSON.parse(text)
}

async function seed() {
  const categoriesData = await readJson("./categories.json")
  const dishesData = await readJson("./dishes.json")

  await connectDB()
  await Promise.all([Category.init(), Dish.init()]) // wait for the unique indexes (code, name.it) before inserting

  await Dish.deleteMany()
  await Category.deleteMany()

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
