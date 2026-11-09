import Reservation, { MAX_PARTY_SIZE } from "../models/Reservation.js"
import { assertBookableDate, assertBookableSlot, assertSlotHasRoom, getFreeSlots, getTablesNeeded, hasBookingStarted } from "../services/availability.js"
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
