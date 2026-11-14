const greetingKey = (time, lang) => {
  if (time < '05:00') return 'evening'
  if (lang === 'en') {
    if (time < '12:00') return 'morning'
    return time < '18:00' ? 'afternoon' : 'evening'
  }
  return time < '14:00' ? 'morning' : 'evening'
}

export default greetingKey
