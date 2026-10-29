import Dish from "../models/Dish.js"
import Category from "../models/Category.js"

const publishedOnly = { isPublished: true } // guests never see unpublished dishes (sold out ones stay visible)
const byCode = { locale: "it", numericOrdering: true } // codes are strings: sort 1, 1a, 3, 12, 108 instead of 1, 108, 12

// Fields the admin can write. image is handled by the upload steps, never from the JSON body
const plainFields = ["code", "price", "category", "allergens", "spiceLevel", "isVegetarian", "isFrozen", "isAvailable", "isPublished", "isFeatured"]
const langFields = ["name", "description"] // { it, en }

const dishNotFound = (id) => {
  const err = new Error(`Dish not found: ${id}`)
  err.status = 404
  err.code = "DISH_NOT_FOUND"
  return err
}

const applyDishFields = (dish, body) => { // copies only the fields sent: works for create and partial update
  for (const field of plainFields) {
    if (body[field] !== undefined) dish[field] = body[field]
  }
  for (const field of langFields) {
    if (body[field]?.it !== undefined) dish[field].it = body[field].it
    if (body[field]?.en !== undefined) dish[field].en = body[field].en
  }
}

const checkCategoryExists = async (categoryId) => { // the schema only checks it's an ObjectId, not that the category is real
  if (categoryId === undefined) return // missing on create --> the required validator answers
  if (!(await Category.exists({ _id: categoryId }))) {
    const err = new Error(`Category not found: ${categoryId}`)
    err.status = 400 // bad value in the body, not a missing route resource
    err.code = "INVALID_CATEGORY"
    throw err
  }
}

const findDishPage = async (filter, query) => { // .sort().skip().limit() + countDocuments() --> { data, page, totalPages }
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))

  const [dishes, total] = await Promise.all([
    Dish.find(filter).sort({ code: 1 }).collation(byCode).skip((page - 1) * limit).limit(limit),
    Dish.countDocuments(filter),
  ])

  return {
    data: dishes,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

export const getDishes = async (req, res) => { // GET /api/dishes (public): whole menu, or one page with ?page
  if (req.query.page === undefined) {
    const dishes = await Dish.find(publishedOnly).sort({ code: 1 }).collation(byCode)
    return res.json(dishes)
  }

  res.json(await findDishPage(publishedOnly, req.query))
}

export const getDishById = async (req, res) => { // GET /api/dishes/:id (public). Bad id --> CastError --> 400 in errorHandler, unpublished --> 404
  const dish = await Dish.findOne({ _id: req.params.id, ...publishedOnly })
  if (!dish) throw dishNotFound(req.params.id)

  res.json(dish)
}

export const getAdminDishes = async (req, res) => { // GET /api/admin/dishes (admin): every dish, unpublished too, always paginated
  res.json(await findDishPage({}, req.query))
}

export const createDish = async (req, res) => { // POST /api/dishes (admin). price in euros (8.5): the Dish setter stores cents
  const body = req.body ?? {}
  await checkCategoryExists(body.category)

  const dish = new Dish()
  applyDishFields(dish, body)
  await dish.save() // duplicate code --> 11000 --> 409 in errorHandler
  res.status(201).json(dish)
}

export const updateDish = async (req, res) => { // PUT /api/dishes/:id (admin): only the fields sent change
  const dish = await Dish.findById(req.params.id)
  if (!dish) throw dishNotFound(req.params.id)

  const body = req.body ?? {}
  await checkCategoryExists(body.category)

  applyDishFields(dish, body)
  await dish.save() // save() runs the full schema validation
  res.json(dish)
}

export const updateAvailability = async (req, res) => { // PATCH /api/dishes/:id/availability (admin, waiter, kitchen)
  const { isAvailable } = req.body ?? {}

  // Explicit value instead of a server-side toggle: two staff tapping "Esaurito" at once can't flip it back
  if (typeof isAvailable !== "boolean") {
    const err = new Error("isAvailable must be true or false")
    err.status = 400
    err.code = "INVALID_AVAILABILITY"
    throw err
  }

  const dish = await Dish.findById(req.params.id)
  if (!dish) throw dishNotFound(req.params.id)

  dish.isAvailable = isAvailable
  await dish.save()
  res.json(dish)
}

export const deleteDish = async (req, res) => { // DELETE /api/dishes/:id (admin). Cloudinary image cleanup comes in step 12
  const dish = await Dish.findById(req.params.id)
  if (!dish) throw dishNotFound(req.params.id)

  await dish.deleteOne()
  res.status(204).end()
}
