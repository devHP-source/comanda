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

const dishSchema = new mongoose.Schema(
  {
    code: { // number printed on the menu, es: 47
      type: Number, 
      required: true, 
      unique: true, 
      min: 1 
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

    price: { // in cents: 850 = € 8,50
      type: Number,
      required: true,
      min: 0,
      validate: { 
        validator: Number.isInteger, 
        message: "price must be an integer (cents)" 
      },
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
  }, { timestamps: true }
)

export default mongoose.model("Dish", dishSchema)
