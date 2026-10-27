export default function errorHandler(err, req, res, next) {
  if (err.name === "ValidationError") { // Mongoose: a field failed schema validation
    const errors = {}
    for (const [field, fieldError] of Object.entries(err.errors)) {
      errors[field] = fieldError.message
    }
    return res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_FAILED",
      errors
    })
  }

  if (err.name === "CastError") { // Mongoose: a value can't be cast to its type
    return res.status(400).json({
      message: `Invalid ${err.path}: ${err.value}`,
      code: "INVALID_ID"
    })
  }

  if (err.code === 11000) { // MongoDB: unique index violated
    const field = Object.keys(err.keyValue)[0]
    return res.status(409).json({
      message: `${field} already exists`,
      code: "DUPLICATE_KEY"
    })
  }

  if (err.type === "entity.parse.failed") { // express.json(): body is not valid JSON
    return res.status(400).json({
      message: "Malformed JSON in request body",
      code: "INVALID_JSON"
    })
  }

  // Our own thrown errors: const err = new Error("..."); err.status = 404; err.code = "DISH_NOT_FOUND"
  const status = err.status || 500
  if (status === 500) {
    console.error(err)
    return res.status(500).json({
      message: "Internal server error",
      code: "INTERNAL_ERROR"
    })
  }

  res.status(status).json({
    message: err.message,
    code: typeof err.code === "string" ? err.code : "REQUEST_FAILED"
  })
}
