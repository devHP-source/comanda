export default function notFound(req, res) {
  res.status(404).json({ // Runs only when no route matched
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND"
  })
}
