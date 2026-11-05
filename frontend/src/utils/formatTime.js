const clock = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

const formatTime = (isoDate) => clock.format(new Date(isoDate)) // "2026-11-05T18:42:10.000Z" --> "19:42" on the comanda's clock

export default formatTime
