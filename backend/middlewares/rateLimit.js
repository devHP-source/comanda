import rateLimit from "express-rate-limit"

export const loginLimiter = rateLimit({ // slows down password guessing on POST /api/auth/login
  windowMs: 15 * 60 * 1000,
  limit: 10, // max 10 failed attempts per IP in the window
  skipSuccessfulRequests: true, // correct logins don't count (demo: log in as often as needed)
  standardHeaders: "draft-8", // RateLimit header tells the client when to retry
  legacyHeaders: false,
  message: { // same { message, code } shape as every other error
    message: "Too many login attempts, try again later",
    code: "TOO_MANY_REQUESTS"
  },
})

export const reservationLimiter = rateLimit({ // every booking saved will send an email: POST /api/reservations
  windowMs: 15 * 60 * 1000,
  limit: 10, // max 10 bookings saved per IP in the window
  skipFailedRequests: true, // a guest fixing a typo in the form isn't penalized
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many booking requests, try again later",
    code: "TOO_MANY_REQUESTS"
  },
})
