// Runs only when no route matched (Express 5: no bare "*" path, so no path at all)
export default function notFound(req, res) {
  res.status(404).json({ 
    message: `Route not found: ${req.method} ${req.originalUrl}` 
  })
}
