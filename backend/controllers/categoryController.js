import mongoose from "mongoose"
import Category from "../models/Category.js"
import Dish, { byCode } from "../models/Dish.js"

const categoryNotFound = () => {
  const err = new Error("Category not found")
  err.status = 404
  err.code = "CATEGORY_NOT_FOUND"
  return err
}

const invalidCoverDish = (message) => {
  const err = new Error(message)
  err.status = 400
  err.code = "INVALID_COVER_DISH"
  return err
}


// Adds coverImage to each category: photo of coverDish, else the first dish of the category with a photo, else "" (the frontend shows a placeholder)
const withCoverImages = async (categories) => {
  const dishesWithPhoto = await Dish.find({ isPublished: true, "image.url": mongoose.trusted({ $ne: "" }) }) // unpublished dishes never preview a category
    .sort({ code: 1 })
    .collation(byCode)
    .select("category image")

  const photoByDish = new Map() // dish _id --> url
  const firstPhotoByCategory = new Map() // category _id --> url of its first dish (by code) with a photo
  for (const dish of dishesWithPhoto) {
    photoByDish.set(String(dish._id), dish.image.url)
    const categoryId = String(dish.category)
    if (!firstPhotoByCategory.has(categoryId)) firstPhotoByCategory.set(categoryId, dish.image.url)
  }

  return categories.map((category) => ({
    ...category.toJSON(),
    coverImage: photoByDish.get(String(category.coverDish)) || firstPhotoByCategory.get(String(category._id)) || "",
  }))
}

export const getCategories = async (req, res) => { // GET /api/categories (public): all categories in menu order, each with a coverImage url.
  const categories = await Category.find().sort({ order: 1 })
  res.json(await withCoverImages(categories))
}

export const getAdminCategories = async (req, res) => { // GET /api/admin/categories (admin): same list + dishCount (unpublished dishes too) for the categories screen
  const [categories, counts] = await Promise.all([
    Category.find().sort({ order: 1 }),
    Dish.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
  ])

  const countByCategory = new Map(counts.map(({ _id, count }) => [String(_id), count]))
  const list = await withCoverImages(categories)
  res.json(list.map((category) => ({ ...category, dishCount: countByCategory.get(String(category._id)) ?? 0 })))
}

const checkCoverDish = async (dishId, categoryId) => { // null or "" --> automatic preview. Otherwise it must be one of this category's dishes
  if (dishId === null || dishId === "") return null
  if (typeof dishId !== "string") throw invalidCoverDish("coverDish must be a dish id or null") // checked before the query: an object never reaches Dish.exists
  if (!(await Dish.exists({ _id: dishId, category: categoryId }))) { // a bad id --> CastError --> 400 INVALID_ID in errorHandler
    throw invalidCoverDish(`Dish ${dishId} is not in this category`)
  }
  return dishId
}

export const createCategory = async (req, res) => { // POST /api/categories (admin). No coverDish: a new category has no dishes yet
  const { name, order, isCompact } = req.body ?? {}

  // Only the fields we expect: anything else in the body is ignored
  const category = await Category.create({
    name: { it: name?.it, en: name?.en },
    order,
    isCompact,
  })
  res.status(201).json(category)
}

export const updateCategory = async (req, res) => { // PUT /api/categories/:id (admin): only the fields sent change
  const category = await Category.findById(req.params.id)
  if (!category) throw categoryNotFound()

  const { name, order, isCompact, coverDish } = req.body ?? {}
  if (name?.it !== undefined) category.name.it = name.it
  if (name?.en !== undefined) category.name.en = name.en
  if (order !== undefined) category.order = order
  if (isCompact !== undefined) category.isCompact = isCompact
  if (coverDish !== undefined) category.coverDish = await checkCoverDish(coverDish, category._id)

  await category.save() // save() runs the full schema validation
  res.json(category)
}

export const deleteCategory = async (req, res) => { // DELETE /api/categories/:id (admin)
  const category = await Category.findById(req.params.id)
  if (!category) throw categoryNotFound()

  const dishCount = await Dish.countDocuments({ category: category._id })   // Never leaves dishes pointing to a missing category: move or delete them first
  if (dishCount > 0) {
    const err = new Error(`Category still has ${dishCount} dishes`)
    err.status = 409
    err.code = "CATEGORY_HAS_DISHES"
    throw err
  }

  await category.deleteOne()
  res.status(204).end()
}
