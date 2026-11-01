import Order, { ORDER_STATUSES } from "../models/Order.js"
import Dish from "../models/Dish.js"
import { getSettings } from "../services/settings.js"

const orderError = (status, code, message, errors) => {
  const err = new Error(message)
  err.status = status
  err.code = code
  if (errors) err.errors = errors // sent as "errors" by errorHandler
  return err
}

export const createOrder = async (req, res) => { // POST /api/orders (waiter, admin): one ticket per "send" { tableNumber, items: [{ dish, qty, notes }] }
  const { tableNumber, items } = req.body ?? {}

  const { tableCount } = await getSettings()
  if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > tableCount) {
    throw orderError(400, "INVALID_TABLE", `tableNumber must be an integer from 1 to ${tableCount}`)
  }

  if (!Array.isArray(items) || items.length === 0 || !items.every((item) => item && typeof item === "object")) {
    throw orderError(400, "EMPTY_ORDER", "items must be a non-empty array of { dish, qty, notes }")
  }

  // One query for every dish of the ticket. A bad id --> CastError --> 400 INVALID_ID in errorHandler
  const dishes = await Dish.find({ _id: { $in: items.map((item) => item.dish) } })
  const dishById = new Map(dishes.map((dish) => [dish._id.toString(), dish]))

  const unknown = items.filter((item) => !dishById.has(String(item.dish)))
  if (unknown.length > 0) {
    throw orderError(400, "INVALID_DISH", `Dish not found: ${unknown.map((item) => item.dish ?? "missing").join(", ")}`)
  }

  // Sold out or hidden from the menu: the waiter's screen may be a few seconds old
  const unavailable = dishes.filter((dish) => !dish.isPublished || !dish.isAvailable)
  if (unavailable.length > 0) {
    const codes = unavailable.map((dish) => dish.code)
    throw orderError(409, "DISH_UNAVAILABLE", `Dish not available: ${codes.join(", ")}`, { dishes: codes }) // the waiter screen marks these lines
  }

  const order = new Order({ // Snapshots built on the server, the client sends only ids, so it can't change a price or a name
    tableNumber,
    round: (await Order.countDocuments({ tableNumber, closedAt: null })) + 1, // "2ª comanda" = second open ticket of the table
    waiter: req.user._id, // the impersonated user while "View as" is on
    items: items.map((item) => {
      const dish = dishById.get(String(item.dish))
      return {
        dish: dish._id,
        codeSnapshot: dish.code,
        nameSnapshot: dish.name.it,
        priceSnapshot: dish.price, // the getter gives euros, the Order setter stores cents again
        qty: item.qty,
        notes: item.notes,
      }
    }),
  })

  await order.save() // qty and notes are checked by the schema --> 400 VALIDATION_FAILED with errors["items.0.qty"]
  res.status(201).json(order)
}

export const getOrders = async (req, res) => { // GET /api/orders?status=sent,preparing (all staff): open tickets, oldest first
  const filter = { closedAt: null } // closed tables leave the kitchen board and the waiter screen

  if (req.query.status !== undefined) {
    const statuses = String(req.query.status).split(",").map((status) => status.trim())
    const invalid = statuses.filter((status) => !ORDER_STATUSES.includes(status))
    if (invalid.length > 0) {
      throw orderError(400, "INVALID_STATUS", `Unknown status: ${invalid.join(", ")}. Use ${ORDER_STATUSES.join(", ")}`)
    }
    filter.status = { $in: statuses }
  }

  const orders = await Order.find(filter)
    .sort({ createdAt: 1 }) // the kitchen cooks the oldest ticket first
    .populate("waiter", "name")
  res.json(orders)
}


const TRANSITIONS = { // Target status changes the status the ticket must be in, and who may move it there
  preparing: { from: "sent", roles: ["kitchen"] },
  ready: { from: "preparing", roles: ["kitchen"] },
  served: { from: "ready", roles: ["waiter", "admin"] }, // any waiter, not only the one who sent the ticket
}

export const updateOrderStatus = async (req, res) => { // PATCH /api/orders/:id/status { status } (all staff, checked by TRANSITIONS)
  const { status } = req.body ?? {}

  const rule = Object.hasOwn(TRANSITIONS, status) ? TRANSITIONS[status] : null // hasOwn: "constructor" isn't a status
  if (!rule) {
    throw orderError(400, "INVALID_STATUS", `status must be one of: ${Object.keys(TRANSITIONS).join(", ")}`)
  }
  if (!rule.roles.includes(req.user.role)) {
    throw orderError(403, "FORBIDDEN", `Only ${rule.roles.join(" or ")} can set a ticket to ${status}`)
  }

  const order = await Order.findById(req.params.id) // bad id sends "CastError" then 400 INVALID_ID
  if (!order) throw orderError(404, "ORDER_NOT_FOUND", `Order not found: ${req.params.id}`)

  if (order.closedAt || order.status !== rule.from) { // One step at a time, and never on a closed table
    const reason = order.closedAt ? "the table is closed" : `the ticket is ${order.status}`
    throw orderError(409, "INVALID_STATUS_TRANSITION", `Can't set ${status}: ${reason}`)
  }

  order.status = status
  await order.save()
  await order.populate("waiter", "name") // same shape as GET /api/orders
  res.json(order)
}
