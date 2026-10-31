import { getSettings } from "../services/settings.js"

// Fields the admin can write. Anything else in the body is ignored
const editableFields = [
  "openingTime", "closingTime", "lastBookingTime", "slotMinutes", "avgDurationMinutes",
  "tableCount", "seatsPerTable", "maxOnlineTables", "maxPartySizeAuto", "maxDaysAhead", "closedDays", "closedDates",
]

// What guests may see (menu intro, /info, booking form). Capacity numbers stay private
const publicFields = ["openingTime", "closingTime", "lastBookingTime", "slotMinutes", "maxPartySizeAuto", "maxDaysAhead", "closedDays", "closedDates"]

export const getAllSettings = async (req, res) => { // GET /api/settings (admin)
  res.json(await getSettings())
}

export const getPublicSettings = async (req, res) => { // GET /api/settings/public
  const settings = await getSettings()
  const result = {}
  for (const field of publicFields) {
    result[field] = settings[field]
  }
  res.json(result)
}

export const updateSettings = async (req, res) => { // PUT /api/settings (admin): only the fields sent change
  const settings = await getSettings()
  const body = req.body ?? {}

  for (const field of editableFields) {
    if (body[field] !== undefined) settings[field] = body[field]
  }

  await settings.save() // runs the field validators and the cross-field rules in pre('validate')
  res.json(settings)
}
