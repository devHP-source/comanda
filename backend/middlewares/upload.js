import multer from "multer"

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_MB = 5

const upload = multer({
  storage: multer.memoryStorage(), // file kept in req.file.buffer and stream to Cloudinary
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 }, // too big --> MulterError LIMIT_FILE_SIZE therefore 400 in errorHandler
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true)

    const err = new Error(`Image must be JPEG, PNG or WebP, got ${file.mimetype}`)
    err.status = 400
    err.code = "INVALID_IMAGE_TYPE"
    cb(err)
  },
})

export const uploadDishImage = upload.single("image")
