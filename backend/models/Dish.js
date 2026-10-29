import mongoose from "mongoose"

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

const eurosToCents = (euros) => {
  if (euros == null || euros === "") return euros // let required answer (Number(null) would be 0)
  // "1.005e2" shifts the decimal point in the string: exactly 100.5 --> rounds half up to 101.
  // 1.005 * 100 would give 100.49999999999999 --> 100 (wrong). Non-numbers --> NaN --> cast error
  const cents = Number(euros + "e2")
  return cents < 0 ? cents : Math.round(cents) // negatives stay as they are: -0.004 must not round to 0 and pass min
}

const centsToEuros = (cents) => (cents == null ? cents : cents / 100)

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

    price: { // API speaks euros (8.5), the DB stores cents (850): no float rounding errors in totals
      type: Number,
      required: true,
      min: [0, "price can't be negative"],
      set: eurosToCents,
      get: centsToEuros, // the setter always stores whole cents: no integer validator needed
    },

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
