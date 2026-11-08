import { MAX_PARTY_SIZE } from "../models/Reservation.js"
import { assertBookableDate, getFreeSlots } from "../services/availability.js"
import { getSettings } from "../services/settings.js"

export const getSlots = async (req, res) => { // GET /api/reservations/slots?date=&partySize= (public)
  const { date } = req.query
  const partySize = Number(req.query.partySize)

  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE) {
    const err = new Error(`partySize must be an integer from 1 to ${MAX_PARTY_SIZE}`)
    err.status = 400
    err.code = "INVALID_PARTY_SIZE"
    throw err
  }

  const settings = await getSettings()
  assertBookableDate(settings, date)

  res.json({ date, partySize, slots: await getFreeSlots(settings, date, partySize) })
}
