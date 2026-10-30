/*
* Run from backend/ by:
* npm run seed 
*/
import "dotenv/config"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import mongoose from "mongoose"
import connectDB from "../config/db.js"
import cloudinary from "../config/cloudinary.js"
import Category from "../models/Category.js"
import Dish from "../models/Dish.js"
import User from "../models/User.js"
import { uploadImage, DISH_IMAGES_FOLDER } from "../services/uploadImage.js"

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"]

async function readJson(fileName) {
  const text = await readFile(new URL(fileName, import.meta.url), "utf-8")
  return JSON.parse(text)
}

// SEED_IMAGES_DIR holds one photo per dish named by its code (47.jpg, P12.jpg) --> Map code -> file path.
// Relative paths start from backend/ (npm run seed runs there). The photos are never in the repo
async function findDishPhotos() {
  const dir = process.env.SEED_IMAGES_DIR
  if (!dir) {
    console.warn("SEED_IMAGES_DIR not set: dishes are seeded without photos")
    return new Map()
  }

  const photos = new Map()
  for (const fileName of await readdir(dir)) { // wrong path --> ENOENT, before anything is deleted
    const { name, ext } = path.parse(fileName)
    if (PHOTO_EXTENSIONS.includes(ext.toLowerCase())) photos.set(name, path.join(dir, fileName))
  }
  return photos
}

// The seed recreates every dish: photos the admin uploaded (random ids) would stay on Cloudinary with no dish
// pointing to them. Wiping the whole folder also catches older orphans; the seed photos are uploaded again right after
async function deleteAllDishPhotos() {
  const result = await cloudinary.api.delete_resources_by_prefix(`${DISH_IMAGES_FOLDER}/`, { invalidate: true })
  console.log(`Deleted ${Object.keys(result.deleted).length} dish photos from Cloudinary`)
}

async function uploadDishPhotos(dishes, photos) {
  let uploaded = 0
  for (const dish of dishes) { // one at a time: simple, and well inside Cloudinary's limits
    const filePath = photos.get(dish.code) // exact match: "P12.jpg" for code "P12"
    if (!filePath) continue // no file --> image stays empty, the frontend shows a placeholder

    // Fixed public_id comanda/dishes/<code>: re-running the seed replaces the same photo, never adds a copy
    dish.image = await uploadImage(await readFile(filePath), DISH_IMAGES_FOLDER, {
      public_id: dish.code,
      overwrite: true,
      invalidate: true,
    })
    await dish.save()
    uploaded++
  }
  console.log(`Uploaded ${uploaded} dish photos`)

  const dishCodes = new Set(dishes.map((dish) => dish.code))
  const unmatched = [...photos.keys()].filter((code) => !dishCodes.has(code))
  if (unmatched.length) console.log(`Skipped photos with no matching dish code: ${unmatched.join(", ")}`)
}

// Optional "coverDish": "<dish code>" in categories.json picks the category preview photo.
// Without it, GET /api/categories uses the first dish of the category with a photo
async function setCoverDishes(categoriesData, categoryIds, dishes) {
  const dishByCode = new Map(dishes.map((dish) => [dish.code, dish]))
  let count = 0

  for (const { name, coverDish: code } of categoriesData) {
    if (!code) continue
    const dish = dishByCode.get(code)
    const categoryId = categoryIds[name.it]
    if (!dish || !dish.category.equals(categoryId)) {
      throw new Error(`Category "${name.it}": coverDish "${code}" is not one of its dishes`)
    }
    await Category.updateOne({ _id: categoryId }, { coverDish: dish._id })
    count++
  }
  console.log(`Set coverDish on ${count} categories`)
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

// Upsert by email instead of delete + create: each user keeps its _id, so orders keep their waiter ref
async function upsertStaff(staffData) {
  const users = []
  for (const data of staffData) {
    const user = (await User.findOne({ email: data.email })) ?? new User()
    user.set({ ...data, isActive: true })
    await user.save() // save(), not findOneAndUpdate(): runs pre('save') so passwords get hashed
    users.push(user)
  }

  const { deletedCount } = await User.deleteMany({ _id: { $nin: users.map((user) => user._id) } }) // and staff tokens still work after a re-seed. Staff not in the list are removed (accounts come only from the seed)
  console.log(`Upserted ${users.length} staff users (${users.map((user) => user.role).join(", ")}), removed ${deletedCount}`)
}

async function seed() {
  const categoriesData = await readJson("./categories.json")
  const dishesData = await readJson("./dishes.json")
  const staffData = getStaffData() // check .env before deleting anything
  const photos = await findDishPhotos() // same: a wrong SEED_IMAGES_DIR stops the seed here

  await connectDB()
  await Promise.all([Category.init(), Dish.init(), User.init()]) // wait for the unique indexes (code, name.it, email) before inserting

  await Dish.deleteMany()
  await Category.deleteMany()
  await deleteAllDishPhotos()

  await upsertStaff(staffData)

  // coverDish in the JSON is a dish code: left out here, set by setCoverDishes once the dishes exist
  const categories = await Category.insertMany(categoriesData.map(({ coverDish, ...category }) => category))
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
    return { ...dish, category: categoryId } // price stays in euros: the Dish setter stores cents
  })

  const insertedDishes = await Dish.insertMany(dishes)
  console.log(`Inserted ${insertedDishes.length} dishes`)

  await uploadDishPhotos(insertedDishes, photos)
  await setCoverDishes(categoriesData, categoryIds, insertedDishes)
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
