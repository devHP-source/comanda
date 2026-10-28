import mongoose from "mongoose"
import bcrypt from "bcrypt"

export const ROLES = ["admin", "waiter", "kitchen"]

const SALT_ROUNDS = 10

const userSchema = new mongoose.Schema( // staff only (guests live in Customer)
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: { // stored as a bcrypt hash; optional for the Google-only owner
      type: String,
      minlength: 8,
      select: false // never returned unless asked with .select("+password")
    },

    role: {
      type: String,
      enum: ROLES,
      required: true
    },

    googleId: { // set on the owner's first Google login
      type: String,
      unique: true,
      sparse: true // many users without googleId are allowed
    },

    avatar: {
      type: String,
      default: ""
    },

    isActive: { // false = blocked at once by authenticate
      type: Boolean,
      default: true
    },
  }, {
    timestamps: true,
    toJSON: {
      transform(doc, ret) { // the hash stays in memory after create(): never send it
        delete ret.password
        return ret
      },
    },
  }
)

userSchema.pre("save", async function () { // Mongoose 9: async hook, no next()
  if (!this.isModified("password")) return // don't hash the hash again on other updates
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS)
})

userSchema.methods.comparePassword = async function (candidate) { // needs .select("+password") on the query
  if (!this.password) return false // Google-only account: no password login
  return bcrypt.compare(candidate, this.password)
}

export default mongoose.model("User", userSchema)
