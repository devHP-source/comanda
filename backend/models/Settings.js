import mongoose from "mongoose"

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/ // "HH:mm", zero-padded: such strings compare correctly as text ("09:30" < "12:00")

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// "2027-02-30" matches the pattern but Date rolls it over to March 2: a real date comes back unchanged
const isRealDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value // month 13 --> Invalid Date
}

const time = (defaultValue) => ({
  type: String,
  required: true,
  match: [TIME_PATTERN, "{PATH} must be HH:mm"],
  default: defaultValue,
})

const integer = (min, max, defaultValue) => ({
  type: Number,
  required: true,
  min,
  max,
  validate: { validator: Number.isInteger, message: "{PATH} must be an integer" },
  default: defaultValue,
})

const settingsSchema = new mongoose.Schema( // always read it through getSettings()
  {
    openingTime: time("12:00"),
    closingTime: time("22:00"),
    lastBookingTime: time("20:30"), // last slot a guest can book online
    slotMinutes: integer(5, 120, 30),
    avgDurationMinutes: integer(15, 300, 90), // how long a booking holds its tables
    tableCount: integer(1, 200, 50),
    seatsPerTable: integer(1, 20, 4),
    maxOnlineTables: integer(0, 200, 36), // the other tables stay for walk-ins
    maxPartySizeAuto: integer(1, 50, 10), // bigger groups --> pending, the admin decides
    maxDaysAhead: integer(1, 365, 30),
    closedDays: { // weekdays as in Date.getDay(): 0 = Sunday ... 6 = Saturday
      type: [integer(0, 6)],
      default: [1], // closed on Mondays
    },
    closedDates: { // one-off closures, "YYYY-MM-DD". No yearly repeat: the admin adds each date
      type: [String],
      set: (dates) => (Array.isArray(dates) ? [...dates].sort() : dates), // zero-padded dates sort by day as text
      validate: [
        { validator: (dates) => dates.every(isRealDate), message: "closedDates must be real dates as YYYY-MM-DD" },
        { validator: (dates) => new Set(dates).size === dates.length, message: "closedDates can't contain the same date twice" },
      ],
      default: [],
    },
  },
  { timestamps: true }
)

// Rules across fields run here, not as field validators: on save() Mongoose only validates the modified paths,
// so a check on lastBookingTime would be skipped when the admin changes only closingTime
settingsSchema.pre("validate", function () {
  const { openingTime, closingTime, lastBookingTime } = this
  const timesValid = [openingTime, closingTime, lastBookingTime].every((value) => TIME_PATTERN.test(value))

  if (timesValid) { // a bad format already has its own error from match
    if (openingTime >= closingTime) {
      this.invalidate("closingTime", "closingTime must be after openingTime")
    }
    if (lastBookingTime <= openingTime || lastBookingTime > closingTime) {
      this.invalidate("lastBookingTime", "lastBookingTime must be after openingTime and not after closingTime")
    }
  }

  if (this.maxOnlineTables > this.tableCount) {
    this.invalidate("maxOnlineTables", "maxOnlineTables can't be more than tableCount")
  }
})

export default mongoose.model("Settings", settingsSchema)
