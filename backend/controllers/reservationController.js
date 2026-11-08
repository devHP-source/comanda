import Reservation, { MAX_PARTY_SIZE } from "../models/Reservation.js"
import { assertBookableDate, assertBookableSlot, assertSlotHasRoom, getFreeSlots, getTablesNeeded } from "../services/availability.js"
import { getSettings } from "../services/settings.js"

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
