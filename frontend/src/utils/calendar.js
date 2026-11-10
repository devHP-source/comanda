export const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday first, as on an Italian calendar (0 = Sunday, like Date.getDay())

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1) // "lunedì" → "Lunedì"

// 0 → "Sunday" / "domenica". 4 Jan 2026 was a Sunday, so day 4 + weekday is that weekday
export const weekdayName = (weekday, lang) =>
  capitalize(new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + weekday))))

// ("2026-12-30", 3) → "2027-01-02". In UTC every day is 24 hours long, even when Italy changes the clocks
export const addDays = (isoDate, days) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// "YYYY-MM-DD" that is a real day: "2026-02-30" and "2026-13-01" are not
export const isRealDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value

// "2026-11-14" → "Sab 14 nov" / "Sat 14 Nov", with the year only when it isn't `currentYear`
export const formatShortDate = (isoDate, lang, currentYear) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  const text = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(year !== currentYear && { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
  return capitalize(text)
}

// "2027-08-16" → "16 agosto 2027" / "16 August 2027"
export const formatDate = (isoDate, lang) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}
