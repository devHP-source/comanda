import Dish, { byCode } from "../models/Dish.js"
import Category from "../models/Category.js"
import { uploadImage, deleteImage, DISH_IMAGES_FOLDER } from "../services/uploadImage.js"

const publishedOnly = { isPublished: true } // guests never see unpublished dishes (sold out ones stay visible)

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

// validates first, upload and save, for create and update. Works the same without a file (JSON requests)
const saveDish = async (dish, file) => {
  await dish.validate() // check the fields before uploading: a bad request never leaves a photo on Cloudinary
  if (!file) return dish.save()

  const oldPublicId = dish.image.publicId // "" on create or when the dish had no photo
  dish.image = await uploadImage(file.buffer, DISH_IMAGES_FOLDER)

  try {
    await dish.save() // duplicate code --> 11000 --> 409 in errorHandler (validate() can't see unique indexes)
  } catch (err) {
    await deleteImage(dish.image.publicId).catch(console.error) // Save failed after the upload: remove the orphan photo, then answer with the original error
    throw err
  }

  if (oldPublicId) await deleteImage(oldPublicId).catch(console.error) // Replaced the old photo goes only after the new one is saved, so the dish never points to a deleted image
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

export const createDish = async (req, res) => { // POST /api/dishes (admin): JSON, or multipart with an optional "image" file. price in euros (8.5): the Dish setter stores cents
  const body = req.body ?? {}
  await checkCategoryExists(body.category)

  const dish = new Dish()
  applyDishFields(dish, body)
  await saveDish(dish, req.file)
  res.status(201).json(dish)
}

export const updateDish = async (req, res) => { // PUT /api/dishes/:id (admin): only the fields sent change. A new "image" file replaces the old one, removeImage: true clears it
  const body = req.body ?? {}
  const removeImage = body.removeImage === true || body.removeImage === "true" // JSON sends a boolean, multipart a string

  if (removeImage && req.file) {
    const err = new Error("Send either removeImage or a new image, not both")
    err.status = 400
    err.code = "REMOVE_IMAGE_WITH_FILE"
    throw err
  }

  const dish = await Dish.findById(req.params.id)
  if (!dish) throw dishNotFound(req.params.id)

  await checkCategoryExists(body.category)

  const oldPublicId = dish.image.publicId
  if (removeImage) dish.image = { url: "", publicId: "" } // the menu shows the placeholder

  applyDishFields(dish, body)
  await saveDish(dish, req.file)

  // Same rule as a replace: the photo leaves Cloudinary only after the dish is saved without it
  if (removeImage && oldPublicId) await deleteImage(oldPublicId).catch(console.error)
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

export const deleteDish = async (req, res) => { // DELETE /api/dishes/:id (admin): the dish and its Cloudinary photo
  const dish = await Dish.findById(req.params.id)
  if (!dish) throw dishNotFound(req.params.id)

  await dish.deleteOne()
  await Category.updateMany({ coverDish: dish._id }, { coverDish: null }) // its category falls back to another dish's photo
  // Photo after the dish: if Cloudinary fails we only leave an unused file, never a dish with a broken image
  if (dish.image.publicId) await deleteImage(dish.image.publicId).catch(console.error)
  res.status(204).end()
}
