import mongoose from "mongoose"
import Reservation from "../models/Reservation.js"
import { isRealDate } from "../models/Settings.js"
import httpError from "../utils/httpError.js"

const DAY_MS = 24 * 60 * 60 * 1000

// hourCycle h23: midnight is "00", not "24". Render runs in UTC, the restaurant's calendar doesn't
const romeClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const availabilityError = (code, message) => httpError(400, code, message) // a date or time that can't be booked

export const romeNow = () => {
  const parts = Object.fromEntries(romeClock.formatToParts(new Date()).map(({ type, value }) => [type, value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

const toMinutes = (time) => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

const toTime = (totalMinutes) => {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0")
  const minutes = String(totalMinutes % 60).padStart(2, "0")
  return `${hours}:${minutes}`
}

// "T00:00:00Z" on both: every day is exactly 24 hours long, even when Italy changes the clocks
const toUtcDay = (date) => new Date(`${date}T00:00:00Z`)

// Every slot of a normal day: openingTime, then one every slotMinutes, up to lastBookingTime
const listSlots = ({ openingTime, lastBookingTime, slotMinutes }) => {
  const slots = []
  for (let minutes = toMinutes(openingTime); minutes <= toMinutes(lastBookingTime); minutes += slotMinutes) {
    slots.push(toTime(minutes))
  }
  return slots
}

// Today the slots that have already started are gone
const listBookableSlots = (settings, date) => {
  const now = romeNow()
  const slots = listSlots(settings)
  return date === now.date ? slots.filter((slot) => slot > now.time) : slots
}

// The most tables the confirmed `bookings` use at once while a party arriving at `time` is seated.
// The tables in use only go up when someone arrives, so the busiest moment of a stay is either when these guests arrive or when another booking arrives while they're seated
const busiestTablesInUse = (bookings, time, avgDurationMinutes) => {
  const arrival = toMinutes(time)
  const stays = bookings.map((booking) => ({ start: toMinutes(booking.time), tables: booking.tablesNeeded }))
  const laterArrivals = stays.map(({ start }) => start).filter((start) => start > arrival && start < arrival + avgDurationMinutes)

  const tablesInUseAt = (moment) => stays
    .filter(({ start }) => start <= moment && moment < start + avgDurationMinutes)
    .reduce((sum, { tables }) => sum + tables, 0)

  return Math.max(...[arrival, ...laterArrivals].map(tablesInUseAt))
}

// The slot has room only if the party fits at the busiest moment of its stay
const slotHasRoom = (bookings, slot, tablesNeeded, { avgDurationMinutes, maxOnlineTables }) =>
  busiestTablesInUse(bookings, slot, avgDurationMinutes) + tablesNeeded <= maxOnlineTables

export const getTablesNeeded = (settings, partySize) => Math.ceil(partySize / settings.seatsPerTable)

export const hasBookingStarted = (date, time) => {
  const now = romeNow()
  return `${date} ${time}` <= `${now.date} ${now.time}` // "YYYY-MM-DD HH:mm" strings sort in time order
}

export const assertBookableDate = (settings, date) => {
  if (!isRealDate(date)) throw availabilityError("INVALID_DATE", "date must be a real date as YYYY-MM-DD")

  const today = romeNow().date
  if (date < today) throw availabilityError("BOOKING_IN_PAST", "Bookings can't be made in the past")

  const daysAhead = (toUtcDay(date) - toUtcDay(today)) / DAY_MS
  if (daysAhead > settings.maxDaysAhead) {
    throw availabilityError("BOOKING_TOO_FAR", `Bookings open ${settings.maxDaysAhead} days ahead`)
  }

  if (settings.closedDays.includes(toUtcDay(date).getUTCDay()) || settings.closedDates.includes(date)) {
    throw availabilityError("RESTAURANT_CLOSED", "The restaurant is closed on this date")
  }
}

export const assertBookableSlot = (settings, date, time) => {
  assertBookableDate(settings, date)
  if (!listSlots(settings).includes(time)) { // covers the format, the opening hours, lastBookingTime and the slot alignment
    throw availabilityError("INVALID_TIME", "time is not one of the restaurant's booking slots")
  }
  if (!listBookableSlots(settings, date).includes(time)) {
    throw availabilityError("BOOKING_IN_PAST", "Bookings can't be made in the past")
  }
}

// The slots of a valid date that can take this party, earliest first
export const getFreeSlots = async (settings, date, partySize) => {
  const slots = listBookableSlots(settings, date)
  if (partySize > settings.maxPartySizeAuto) return slots // big groups skip the count: the admin decides

  const tablesNeeded = getTablesNeeded(settings, partySize)
  const bookings = await Reservation.find({ date, status: "confirmed" }).select("time tablesNeeded") // only confirmed bookings hold tables

  return slots.filter((slot) => slotHasRoom(bookings, slot, tablesNeeded, settings))
}

// Online tables still free at the busiest moment of a stay starting at `time`, never below 0 (Settings may have lowered maxOnlineTables).
export const getFreeTables = async (settings, date, time, excludeId) => {
  // excludeId: the booking being checked must not count its own tables, if it's already confirmed
  const bookings = await Reservation.find({ date, status: "confirmed", _id: mongoose.trusted({ $ne: excludeId }) }).select("time tablesNeeded")
  return Math.max(0, settings.maxOnlineTables - busiestTablesInUse(bookings, time, settings.avgDurationMinutes))
}

// What to suggest when the chosen time is full: closest first, on a tie the earlier one
const pickNearestSlots = (slots, time, limit = 3) => {
  const distance = (slot) => Math.abs(toMinutes(slot) - toMinutes(time))
  return [...slots].sort((a, b) => distance(a) - distance(b)).slice(0, limit)
}

// Big groups always pass: getFreeSlots doesn't count tables for them
export const assertSlotHasRoom = async (settings, date, time, partySize) => {
  const freeSlots = await getFreeSlots(settings, date, partySize)
  if (freeSlots.includes(time)) return

  throw httpError(409, "SLOT_FULL", "This time is fully booked", { slots: pickNearestSlots(freeSlots, time) }) // the form suggests these times
}
