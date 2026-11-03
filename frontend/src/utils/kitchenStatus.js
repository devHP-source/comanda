const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // index = closedDays number (0 = Sunday)

const romeClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome', // the restaurant's clock, whatever the guest's phone says
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const romeNow = (date) => { // { date: "2026-11-03", time: "14:05", weekday: 2 }
  const parts = Object.fromEntries(romeClock.formatToParts(date).map(({ type, value }) => [type, value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS.indexOf(parts.weekday),
  }
}

// open | closedToday | closedNow, from the public settings. "HH:mm" strings compare correctly as text
const kitchenStatus = (settings, date = new Date()) => {
  const now = romeNow(date)
  if (settings.closedDays.includes(now.weekday) || settings.closedDates.includes(now.date)) return 'closedToday'
  if (now.time >= settings.openingTime && now.time < settings.closingTime) return 'open'
  return 'closedNow'
}

export default kitchenStatus
