export default function errorHandler(err, req, res, next) {
  if (err.name === "ValidationError") { // Mongoose: a field failed schema validation
    const errors = {}
    for (const [field, fieldError] of Object.entries(err.errors)) {
      errors[field] = fieldError.message
    }
    return res.status(400).json({ 
      message: "Validation failed", 
      errors 
    })
  }

  if (err.name === "CastError") { // Mongoose: a value can't be cast to its type
    return res.status(400).json({ 
      message: `Invalid ${err.path}: ${err.value}` 
    })
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ 
      message: `${field} already exists` 
    })
  }

  const status = err.status || 500;
  if (status === 500) console.error(err);

  res.status(status).json({
    message: status === 500 ? "Internal server error" : err.message,
  })
}
