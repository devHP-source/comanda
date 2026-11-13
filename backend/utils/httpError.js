// Every error we throw on purpose. errorHandler answers with this status and { message, code } (+ errors)
const httpError = (status, code, message, errors) => {
  const err = new Error(message)
  err.status = status
  err.code = code
  if (errors) err.errors = errors // optional details, e.g. { dishes: ["47", "P12"] }
  return err
}

export default httpError
