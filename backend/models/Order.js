import mongoose from "mongoose"
import { priceField } from "./price.js"

// sent (waiter) --> preparing --> ready (kitchen) --> served (waiter/admin)
export const ORDER_STATUSES = ["sent", "preparing", "ready", "served"]

const integer = (min, max) => ({
  type: Number,
  required: true,
  min,
  max,
  validate: { validator: Number.isInteger, message: "{PATH} must be an integer" },
})

// One line of the ticket. Snapshots copy the dish at send time: later price or name changes don't touch old tickets
const orderItemSchema = new mongoose.Schema(
  {
    dish: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dish",
      required: true,
    },
    codeSnapshot: { // dish code printed on the menu ("47", "P12"): staff work with numbers
      type: String,
      required: true,
      trim: true,
    },
    nameSnapshot: { // Italian name: staff screens are in Italian
      type: String,
      required: true,
      trim: true,
    },
    priceSnapshot: priceField(), // euros in the API, cents in the DB, like Dish.price
    qty: integer(1, 99),
    notes: { // "senza cipolla", "ben cotta"
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
  },
  {
    _id: false, // a sent ticket is never edited: its items need no id
    toJSON: { getters: true, virtuals: false },
  }
)

const orderSchema = new mongoose.Schema( // One ticket (comanda) = one "send" by the waiter. A table gets a new ticket per round, never an edited one
  {
    tableNumber: integer(1), // the upper limit is Settings.tableCount, checked by the controller
    round: integer(1), // 1, 2, 3... = "2ª comanda", counted among the table's open tickets
    closedAt: { // null while the table is open, set by "Libera tavolo"
      type: Date,
      default: null,
    },
    waiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "sent",
    },
    items: {
      type: [orderItemSchema],
      validate: { validator: (items) => items.length > 0, message: "items can't be empty" },
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: false }, // res.json() sends priceSnapshot in euros
  }
)

orderSchema.index({ tableNumber: 1, closedAt: 1 }) // "open tickets of table 12": round count, table total, Libera tavolo

export default mongoose.model("Order", orderSchema)
