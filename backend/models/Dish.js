import mongoose from "mongoose"
import { priceField } from "./price.js"

// The 14 allergens EU law requires on menus (Reg. 1169/2011)
export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
]

export const byCode = { // Codes are strings: 
  locale: "it", 
  numericOrdering: true 
} // this collation sorts 1, 1a, 3, 12, 108 instead of 1, 108, 12. Use with .sort({ code: 1 })

const dishSchema = new mongoose.Schema(
  {
    code: { // number printed on the menu, es: 47 (String: also "1a", "15g", "P12")
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    name: {
      it: { 
        type: String, 
        required: true, 
        trim: true 
      },
      en: { 
        type: String, 
        trim: true, 
        default: "" 
      },
    },

    description: {
      it: { 
        type: String, 
        trim: true, 
        default: "" 
      },
      en: { 
        type: String, 
        trim: true, 
        default: "" 
      },
    },

    price: priceField(), // API speaks euros (8.5), the DB stores cents (850)

    image: {
      url: { 
        type: String, 
        default: "" 
      },
      publicId: { // Cloudinary id, needed to delete the image
        type: String, 
        default: "" 
      }, 
    },

    category: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Category", 
      required: true 
    },

    allergens: [{ 
      type: String, 
      enum: ALLERGENS 
    }],

    spiceLevel: { 
      type: Number, 
      min: 0, 
      max: 3, 
      default: 0 
    },

    isVegetarian: { 
      type: Boolean, 
      default: false 
    },

    isFrozen: { // shown with an asterisk, required in Italy
      type: Boolean, 
      default: false 
    }, 

    isAvailable: { 
      type: Boolean, 
      default: true // false = sold out ("Esaurito")
    }, 

    isPublished: { 
      type: Boolean, 
      default: true 
    },

    isFeatured: { // "Consigliati dallo chef"
      type: Boolean, 
      default: false 
    },
  }, {
    timestamps: true,
    toJSON: { getters: true, virtuals: false }, // res.json() sends price in euros; virtuals: false keeps the extra "id" out
  }
)

export default mongoose.model("Dish", dishSchema)
