import Reservation, { MAX_PARTY_SIZE, RESERVATION_STATUSES } from "../models/Reservation.js"
import { isRealDate } from "../models/Settings.js"
import { assertBookableDate, assertBookableSlot, assertSlotHasRoom, getFreeSlots, getTablesNeeded, hasBookingStarted, romeNow } from "../services/availability.js"
import { getSettings } from "../services/settings.js"

const reservationError = (status, code, message) => {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

const assertPartySize = (partySize) => {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE) {
    const err = new Error(`partySize must be an integer from 1 to ${MAX_PARTY_SIZE}`)
    err.status = 400
    err.code = "INVALID_PARTY_SIZE"
    throw err
  }
}

export const getSlots = async (req, res) => { // GET /api/reservations/slots?date=&partySize= (public)
  const { date } = req.query
  const partySize = Number(req.query.partySize)

  assertPartySize(partySize)

  const settings = await getSettings()
  assertBookableDate(settings, date)

  res.json({ date, partySize, slots: await getFreeSlots(settings, date, partySize) })
}

export const createReservation = async (req, res) => { // POST /api/reservations (public, form without Google): { name, surname, email, phone, date, time, partySize, notes }
  const { name, surname, email, phone, date, time, partySize, notes } = req.body ?? {} // only these fields: status, source and tokens are never read from the client

  assertPartySize(partySize)

  const settings = await getSettings()
  assertBookableSlot(settings, date, time)
  await assertSlotHasRoom(settings, date, time, partySize) // tells the guest now if it's already full. An unverified booking still holds no tables: the real check runs when the email link is clicked

  const reservation = await Reservation.create({
    name,
    surname,
    email,
    phone,
    date,
    time,
    partySize,
    notes,
    tablesNeeded: getTablesNeeded(settings, partySize),
    source: "form",
    status: partySize > settings.maxPartySizeAuto ? "pending" : "awaiting_verification", // big groups: the admin decides
  })

  if (reservation.verifyToken) { // until the emails exist the link is only in the server logs
    console.log(`Verify link for ${reservation.email}: ${req.protocol}://${req.get("host")}/api/reservations/verify/${reservation.verifyToken}`)
  }

  res.status(201).json(reservation)
}

export const verifyReservation = async (req, res) => { // GET /api/reservations/verify/:token (public, the link in the email)
  const reservation = await Reservation.findOne({ verifyToken: req.params.token }).select("+cancelToken")

  if (reservation?.status === "confirmed") return res.json(reservation) // second click on the link: nothing to do, and counting again would count this booking too

  // The TTL monitor only runs about once a minute, so an expired booking can still be here
  if (reservation?.status !== "awaiting_verification" || reservation.expiresAt <= new Date()) {
    throw reservationError(404, "RESERVATION_NOT_FOUND", "This link is not valid or has expired")
  }

  const settings = await getSettings()
  assertBookableSlot(settings, reservation.date, reservation.time) // the time may have passed while the email was unread
  await assertSlotHasRoom(settings, reservation.date, reservation.time, reservation.partySize) // the real check: until now this booking held no tables

  reservation.status = "confirmed"
  await reservation.save()

  // until the emails exist the link is only in the server logs
  console.log(`Cancel link for ${reservation.email}: POST ${req.protocol}://${req.get("host")}/api/reservations/cancel/${reservation.cancelToken}`)

  res.json(reservation)
}

export const cancelReservation = async (req, res) => { // POST /api/reservations/cancel/:token (public, the link in the confirmation email)
  const reservation = await Reservation.findOne({ cancelToken: req.params.token })

  if (!reservation) throw reservationError(404, "RESERVATION_NOT_FOUND", "This link is not valid")

  if (reservation.status === "cancelled") return res.json(reservation) // second click on the link: nothing to do

  if (reservation.status !== "confirmed") { // only confirmed bookings receive the cancel link
    throw reservationError(409, "RESERVATION_NOT_CANCELLABLE", "Only confirmed bookings can be cancelled")
  }

  if (hasBookingStarted(reservation.date, reservation.time)) {
    throw reservationError(409, "RESERVATION_ALREADY_STARTED", "Past bookings can't be cancelled")
  }

  reservation.status = "cancelled" // its tables are free again: only confirmed bookings are counted
  await reservation.save()

  res.json(reservation)
}

const adminListFilter = ({ date, status }) => { // both filters are optional, status can be a comma list
  const filter = {}

  if (date !== undefined) {
    if (!isRealDate(date)) throw reservationError(400, "INVALID_DATE", "date must be a real date as YYYY-MM-DD")
    filter.date = date
  }

  if (status !== undefined) {
    const statuses = String(status).split(",").map((value) => value.trim())
    const invalid = statuses.filter((value) => !RESERVATION_STATUSES.includes(value))
    if (invalid.length > 0) {
      throw reservationError(400, "INVALID_STATUS", `Unknown status: ${invalid.join(", ")}. Use ${RESERVATION_STATUSES.join(", ")}`)
    }
    filter.status = { $in: statuses }
  }

  return filter
}

const WAITER_FIELDS = "_id name surname date time partySize tablesNeeded notes phone" // data minimization: never the guest's email

export const getReservations = async (req, res) => { // GET /api/reservations (admin: ?date=&status=&page=&limit=, every field. Waiter: today's confirmed bookings, whatever the filters say, WAITER_FIELDS only)
  const isAdmin = req.user.role === "admin"
  const filter = isAdmin
    ? adminListFilter(req.query)
    : { date: romeNow().date, status: "confirmed" }

  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))

  const query = Reservation.find(filter)
    .sort({ date: -1, time: 1, _id: 1 }) // latest day first so old bookings don't bury the new ones, service order inside a day. _id: rows with the same time can't jump between pages
    .skip((page - 1) * limit)
    .limit(limit)

  if (isAdmin) query.populate("handledBy", "name")
  else query.select(WAITER_FIELDS) // no populate here: Mongoose would add handledBy back to the selected fields

  const [reservations, total] = await Promise.all([query, Reservation.countDocuments(filter)])

  res.json({
    ...(!isAdmin && { date: filter.date }), // the restaurant's "today" (Europe/Rome), which the waiter screen can show
    data: reservations,
    page,
    totalPages: Math.ceil(total / limit),
    total,
  })
}

const STATUS_TRANSITIONS = { // Target status --> the statuses the booking may be in
  confirmed: ["pending"], // an unverified booking can't be confirmed by hand: only its email link proves the address
  rejected: ["pending"],
  cancelled: ["confirmed"],
}

export const updateReservationStatus = async (req, res) => { // PATCH /api/reservations/:id/status { status } (admin)
  const { status } = req.body ?? {}

  const allowedFrom = Object.hasOwn(STATUS_TRANSITIONS, status) ? STATUS_TRANSITIONS[status] : null // hasOwn: "constructor" isn't a status
  if (!allowedFrom) {
    throw reservationError(400, "INVALID_STATUS", `status must be one of: ${Object.keys(STATUS_TRANSITIONS).join(", ")}`)
  }

  const reservation = await Reservation.findById(req.params.id) // bad id --> CastError --> 400 INVALID_ID
  if (!reservation) throw reservationError(404, "RESERVATION_NOT_FOUND", `Reservation not found: ${req.params.id}`)

  if (!allowedFrom.includes(reservation.status)) {
    throw reservationError(409, "INVALID_RESERVATION_TRANSITION", `Can't set ${status}: the booking is ${reservation.status}`)
  }

  // Rejecting stays possible, so a big group nobody answered in time doesn't wait forever. No capacity check on confirm: for big groups the admin decides
  if (status !== "rejected" && hasBookingStarted(reservation.date, reservation.time)) {
    throw reservationError(409, "RESERVATION_ALREADY_STARTED", `Past bookings can't be set to ${status}`)
  }

  reservation.status = status
  reservation.handledBy = req.user._id
  await reservation.save()
  await reservation.populate("handledBy", "name") // same shape as GET /api/reservations
  res.json(reservation)
}
