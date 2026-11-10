import Reservation, { MAX_PARTY_SIZE, RESERVATION_STATUSES } from "../models/Reservation.js"
import { isRealDate } from "../models/Settings.js"
import { assertBookableDate, assertBookableSlot, assertSlotHasRoom, getFreeSlots, getTablesNeeded, hasBookingStarted, romeNow } from "../services/availability.js"
import { sendBigGroupNotice, sendBookingDeclinedEmail, sendConfirmationEmail, sendVerifyEmail } from "../services/email.js"
import { getSettings } from "../services/settings.js"
import { verifyTurnstile } from "../services/turnstile.js"

const reservationError = (status, code, message) => {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

// Only the verify email decides whether a booking exists. Any other email that fails was already logged by send(), and the booking stands
const sendWithoutFailing = async (sendEmail, reservation) => {
  try {
    await sendEmail(reservation)
  } catch {
    // nothing else to do: the guest or the admin still gets the right status in the response
  }
}

const assertPartySize =(partySize) => {
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

const EMAIL_LIMIT = 3 // open bookings (each one sent an email) per address in the last hour
const EMAIL_LIMIT_WINDOW_MS = 60 * 60 * 1000

const assertEmailUnderLimit = async (email) => { // on top of the per-IP limit: one address can't be flooded with emails from many IPs
  const openBookings = await Reservation.countDocuments({
    email,
    status: { $in: ["awaiting_verification", "pending"] },
    createdAt: { $gte: new Date(Date.now() - EMAIL_LIMIT_WINDOW_MS) },
  })

  if (openBookings >= EMAIL_LIMIT) {
    throw reservationError(429, "TOO_MANY_BOOKINGS", `At most ${EMAIL_LIMIT} open bookings per email address in one hour`)
  }
}

export const createReservation = async (req, res) => { // POST /api/reservations (public, form without Google): { name, surname, email, phone, date, time, partySize, notes, lang, turnstileToken }
  const { name, surname, email, phone, date, time, partySize, notes, lang, turnstileToken } = req.body ?? {} // only these fields: status, source and tokens are never read from the client

  assertPartySize(partySize)
  await verifyTurnstile(turnstileToken, req.ip) // first: a request without a valid token runs no query at all. The token is never saved

  const settings = await getSettings()
  assertBookableSlot(settings, date, time)
  await assertSlotHasRoom(settings, date, time, partySize) // tells the guest now if it's already full. An unverified booking still holds no tables: the real check runs when the email link is clicked

  const reservation = new Reservation({
    name,
    surname,
    email,
    phone,
    date,
    time,
    partySize,
    notes,
    lang,
    tablesNeeded: getTablesNeeded(settings, partySize),
    source: "form",
    status: partySize > settings.maxPartySizeAuto ? "pending" : "awaiting_verification", // big groups: the admin decides
  })

  await reservation.validate() // 400 VALIDATION_FAILED before counting: the limit query needs the cleaned email (trimmed, lowercased)
  await assertEmailUnderLimit(reservation.email)
  await reservation.save()

  if (reservation.status === "awaiting_verification") {
    try {
      await sendVerifyEmail(reservation) // verifyToken is still in memory after save()
    } catch (err) {
      await Reservation.deleteOne({ _id: reservation._id }) // a booking whose link never arrived can't be confirmed: remove it so the guest can simply try again
      throw err // 502 EMAIL_SEND_FAILED
    }
  } else {
    await sendWithoutFailing(sendBigGroupNotice, reservation)
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

  await sendWithoutFailing(sendConfirmationEmail, reservation) // only the first click gets here: a second one returned above, so no second email

  res.json(reservation)
}

const CANCELLABLE_STATUSES = ["confirmed", "pending"] // the two emails with a cancel link: the confirmation and the big-group notice (the guest withdraws the request)

export const getCancelDetails = async (req, res) => { // GET /api/reservations/cancel/:token (public, read-only): which booking the cancel page is about, whatever its status, so the page can say why it can't be cancelled. Changes nothing: only the button on that page sends the POST
  const reservation = await Reservation.findOne({ cancelToken: req.params.token })

  if (!reservation) throw reservationError(404, "RESERVATION_NOT_FOUND", "This link is not valid")

  res.json({ // no personal data: anyone who sees the link (a forwarded email) learns only these
    date: reservation.date,
    time: reservation.time,
    partySize: reservation.partySize,
    status: reservation.status,
    hasStarted: hasBookingStarted(reservation.date, reservation.time),
  })
}

export const cancelReservation = async (req, res) => { // POST /api/reservations/cancel/:token (public, the link in the confirmation email or in the big-group notice)
  const reservation = await Reservation.findOne({ cancelToken: req.params.token })

  if (!reservation) throw reservationError(404, "RESERVATION_NOT_FOUND", "This link is not valid")

  if (reservation.status === "cancelled") return res.json(reservation) // second click on the link: nothing to do

  if (!CANCELLABLE_STATUSES.includes(reservation.status)) { // rejected, or awaiting_verification (its emails have no cancel link)
    throw reservationError(409, "RESERVATION_NOT_CANCELLABLE", `Only ${CANCELLABLE_STATUSES.join(" or ")} bookings can be cancelled`)
  }

  if (hasBookingStarted(reservation.date, reservation.time)) {
    throw reservationError(409, "RESERVATION_ALREADY_STARTED", "Past bookings can't be cancelled")
  }

  reservation.status = "cancelled" // confirmed: its tables are free again (only confirmed bookings are counted). Pending: the admin can no longer confirm it
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

  const reservation = await Reservation.findById(req.params.id).select("+cancelToken") // bad id --> CastError --> 400 INVALID_ID. cancelToken: the confirmation email links to it
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

  await sendWithoutFailing(status === "confirmed" ? sendConfirmationEmail : sendBookingDeclinedEmail, reservation) // rejected or cancelled: one short "sorry" email
  await reservation.populate("handledBy", "name") // same shape as GET /api/reservations
  res.json(reservation)
}
