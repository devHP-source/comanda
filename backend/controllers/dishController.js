import Dish from "../models/Dish.js"

const publishedOnly = { isPublished: true } // guests never see unpublished dishes (sold out ones stay visible)
const byCode = { locale: "it", numericOrdering: true } // codes are strings: sort 1, 1a, 3, 12, 108 instead of 1, 108, 12

export async function getDishes(req, res) { // GET /api/dishes (public): whole menu, or one page with ?page
  if (req.query.page === undefined) {
    const dishes = await Dish.find(publishedOnly).sort({ code: 1 }).collation(byCode)
    return res.json(dishes)
  }

  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))

  const [dishes, total] = await Promise.all([
    Dish.find(publishedOnly).sort({ code: 1 }).collation(byCode).skip((page - 1) * limit).limit(limit),
    Dish.countDocuments(publishedOnly),
  ])

  res.json({
    data: dishes,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

export async function getDishById(req, res) { // GET /api/dishes/:id (public). Bad id --> CastError --> 400 in errorHandler, unpublished --> 404
  const dish = await Dish.findOne({ _id: req.params.id, ...publishedOnly })

  if (!dish) {
    const err = new Error(`Dish not found: ${req.params.id}`)
    err.status = 404
    err.code = "DISH_NOT_FOUND"
    throw err
  }

  res.json(dish)
}
