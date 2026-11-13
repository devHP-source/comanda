// Cloudflare Turnstile: checks on the server the token the booking form got from the widget. A token works once and expires after 5 minutes
import httpError from "../utils/httpError.js"

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const MAX_TOKEN_LENGTH = 2048 // Cloudflare's own limit
const OUR_SIDE_ERRORS = ["missing-input-secret", "invalid-input-secret", "internal-error"] // wrong or missing secret, or Cloudflare's own failure: not the guest's fault

const failed = () => httpError(400, "CAPTCHA_FAILED", "The security check failed, try again")
const unavailable = () => httpError(502,"CAPTCHA_UNAVAILABLE", "The security check is not available right now, try again later")

export const verifyTurnstile = async (token, ip) => {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw failed() // no need to ask Cloudflare
  }

  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    console.error("Turnstile not checked: TURNSTILE_SECRET_KEY is missing")
    throw unavailable()
  }

  let result
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10000), // Cloudflare unreachable: the guest gets an answer after 10 s at most
    })
    if (!response.ok) throw new Error(`siteverify answered ${response.status}`)
    result = await response.json()
  } catch (err) {
    console.error(`Turnstile not reachable: ${err.message}`)
    throw unavailable()
  }

  if (result.success) return

  const errorCodes = result["error-codes"] ?? []
  console.error(`Turnstile refused the token: ${errorCodes.join(", ") || "no error code"}`) // never the token itself

  if (errorCodes.some((code) => OUR_SIDE_ERRORS.includes(code))) throw unavailable()
  throw failed()
}
