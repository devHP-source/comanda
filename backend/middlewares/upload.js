import multer from "multer"
import httpError from "../utils/httpError.js"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_MB = 5

const upload = multer({
  storage: multer.memoryStorage(), // the file stays in req.file.buffer and is streamed to Cloudinary
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 }, // too big --> MulterError LIMIT_FILE_SIZE --> 400 in errorHandler
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true)
    cb(httpError(400, "INVALID_IMAGE_TYPE", `Image must be JPEG, PNG or WebP, got ${file.mimetype}`))
  },
})

export const uploadDishImage = upload.single("image")
