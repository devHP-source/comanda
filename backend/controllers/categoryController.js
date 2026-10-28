import Category from "../models/Category.js"

export async function getCategories(req, res) { // GET /api/categories (public): all categories in menu order
  const categories = await Category.find().sort({ order: 1 })
  res.json(categories)
}
