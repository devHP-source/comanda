export const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday first, as on an Italian calendar (0 = Sunday, like Date.getDay())

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1) // "lunedì" → "Lunedì"

// 0 → "Sunday" / "domenica". 4 Jan 2026 was a Sunday, so day 4 + weekday is that weekday
export const weekdayName = (weekday, lang) =>
  capitalize(new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + weekday))))

// "2027-08-16" → "16 agosto 2027" / "16 August 2027"
export const formatDate = (isoDate, lang) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
}
