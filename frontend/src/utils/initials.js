// "Mario Rossi" → "MR": avatar letters when a staff account has no photo
const initials = (name) => name
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word[0].toUpperCase())
  .join('')

export default initials
