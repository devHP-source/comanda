import Category from "../models/Category.js"
import Dish, { byCode } from "../models/Dish.js"

const categoryNotFound = () => {
  const err = new Error("Category not found")
  err.status = 404
  err.code = "CATEGORY_NOT_FOUND"
  return err
}


export const getCategories = async (req, res) => { // GET /api/categories (public): all categories in menu order, each with a coverImage url.
  const [categories, dishesWithPhoto] = await Promise.all([
    Category.find().sort({ order: 1 }),
    Dish.find({ isPublished: true, "image.url": { $ne: "" } }) // unpublished dishes never preview a category
      .sort({ code: 1 })
      .collation(byCode)
      .select("category image"), // coverImage = photo of coverDish, else the first dish of the category with a photo, else "" (the frontend shows a placeholder)
  ])

  const photoByDish = new Map() // dish _id --> url
  const firstPhotoByCategory = new Map() // category _id --> url of its first dish (by code) with a photo
  for (const dish of dishesWithPhoto) {
    photoByDish.set(String(dish._id), dish.image.url)
    const categoryId = String(dish.category)
    if (!firstPhotoByCategory.has(categoryId)) firstPhotoByCategory.set(categoryId, dish.image.url)
  }

  res.json(categories.map((category) => ({
    ...category.toJSON(),
    coverImage: photoByDish.get(String(category.coverDish)) || firstPhotoByCategory.get(String(category._id)) || "",
  })))
}

export const createCategory = async (req, res) => { // POST /api/categories (admin)
  const { name, order } = req.body ?? {}

  // Only the fields we expect: anything else in the body is ignored
  const category = await Category.create({
    name: { it: name?.it, en: name?.en },
    order,
  })
  res.status(201).json(category)
}

export const updateCategory = async (req, res) => { // PUT /api/categories/:id (admin): only the fields sent change
  const category = await Category.findById(req.params.id)
  if (!category) throw categoryNotFound()

  const { name, order } = req.body ?? {}
  if (name?.it !== undefined) category.name.it = name.it
  if (name?.en !== undefined) category.name.en = name.en
  if (order !== undefined) category.order = order

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
