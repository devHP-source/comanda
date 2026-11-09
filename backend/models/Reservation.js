import { randomBytes } from "node:crypto"
import mongoose from "mongoose"
import { TIME_PATTERN, isRealDate } from "./Settings.js"

// awaiting_verification (email link not clicked yet, holds no seats) --> confirmed. Big groups: pending --> confirmed/rejected
export const RESERVATION_STATUSES = ["awaiting_verification", "confirmed", "pending", "rejected", "cancelled"]

export const MAX_PARTY_SIZE = 200 // the whole restaurant a bigger number is only bad input

const VERIFY_WINDOW_MS = 30 * 60 * 1000

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/ // the labels can't contain dots: a very long public input can't slow the regex down
const E164_PATTERN = /^\+[1-9]\d{5,14}$/ // "+393331234567": 6-15 digits including the prefix

const generateToken = () => randomBytes(32).toString("hex")

const positiveInteger = {
  type: Number,
  required: true,
  min: 1,
  validate: { validator: Number.isInteger, message: "{PATH} must be an integer" },
}

const requiredName = {
  type: String,
  required: true,
  trim: true,
  maxlength: 60,
}

const reservationSchema = new mongoose.Schema(
  {
    customer: { // only for bookings made after a Google login
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    name: requiredName,
    surname: requiredName,
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [EMAIL_PATTERN, "email is not valid"],
    },
    phone: {
      type: String,
      required: true,
      match: [E164_PATTERN, "phone must be in E.164 format"],
    },
    date: { // strings, not Date: "20:00 on the 12th" must stay the same on Render, which runs in UTC
      type: String,
      required: true,
      validate: { validator: isRealDate, message: "date must be a real date as YYYY-MM-DD" },
    },
    time: {
      type: String,
      required: true,
      match: [TIME_PATTERN, "time must be HH:mm"],
    },
    partySize: { ...positiveInteger, max: MAX_PARTY_SIZE },
    tablesNeeded: positiveInteger, // Math.ceil(partySize / seatsPerTable), saved so that a later Settings change can't alter old bookings
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    source: {
      type: String,
      enum: ["google", "form"],
      required: true,
    },
    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: "awaiting_verification",
    },
    lang: { // the language of this guest's emails: the admin's answer to a big group comes later, with no guest request to read it from
      type: String,
      enum: ["it", "en"],
      default: "it",
    },
    verifyToken: { // only bookings that go through the email link have one. Kept after confirming, so a second click isn't told the link is invalid
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
    cancelToken: { // the link in the confirmation email
      type: String,
      unique: true,
      default: generateToken,
      select: false,
    },
    expiresAt: Date, // the TTL index below deletes the booking at this moment
    handledBy: { // the admin who last changed its status
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => { // the tokens stay in memory after create(): never send them
        delete ret.verifyToken
        delete ret.cancelToken
        return ret
      },
    },
  }
)

// Status changes must go through save(), not findOneAndUpdate(): only save() runs this hook
reservationSchema.pre("validate", function () {
  if (this.status !== "awaiting_verification") {
    this.expiresAt = undefined // left in place, the TTL index would delete a confirmed booking
  } else if (this.isNew) { // isNew: a normal query doesn't load verifyToken, so a later save must not replace it
    this.verifyToken = generateToken()
    this.expiresAt = new Date(Date.now() + VERIFY_WINDOW_MS)
  }
})

reservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // bookings without expiresAt are never deleted
reservationSchema.index({ date: 1, status: 1 }) // capacity check and staff lists

export default mongoose.model("Reservation", reservationSchema)
