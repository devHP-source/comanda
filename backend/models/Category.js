import mongoose from "mongoose"

const categorySchema = new mongoose.Schema(
  {
    name: {
      it: { type: String, required: true, trim: true, unique: true }, // the seed links dishes by Italian name
      en: { type: String, trim: true, default: "" },
    },
    order: { type: Number, default: 0 }, // position in the menu
  },
  { timestamps: true }
)

export default mongoose.model("Category", categorySchema)
