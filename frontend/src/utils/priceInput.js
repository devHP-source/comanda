const PRICE_PATTERN = /^\d{1,4}([.,]\d{1,2})?$/ // "5,60", "5.6", "12": up to 2 decimals, comma or dot

export const parsePriceInput = (text) => { // what the admin typed --> euros for the API (5.6), null when it isn't a price
  const clean = text.replace(/[\s€]/g, '')
  if (!PRICE_PATTERN.test(clean)) return null
  return Number(clean.replace(',', '.'))
}

export const toPriceInput = (euros) => euros.toFixed(2).replace('.', ',') // 5.6 from the API --> "5,60" in the input
