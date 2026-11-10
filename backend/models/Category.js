import mongoose from "mongoose"

const categorySchema = new mongoose.Schema(
  {
    name: {
      it: { type: String, required: true, trim: true, unique: true }, // the seed links dishes by Italian name
      en: { type: String, trim: true, default: "" },
    },
    order: { type: Number, default: 0 }, // position in the menu
    isCompact: { type: Boolean, default: false }, // menu shows it as a compact list without photos (Bevande)
    coverDish: { // dish whose photo previews the category (optional). GET /api/categories turns it into coverImage
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dish",
      default: null,
    },
  },
  { timestamps: true }
)

export default mongoose.model("Category", categorySchema)
