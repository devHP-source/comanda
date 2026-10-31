/*
* Prices: the API speaks euros (8.5), 
* MongoDB stores cents (850) --> no float rounding errors in totals.
*/
export const eurosToCents = (euros) => { // Shared by Dish.price and Order items.priceSnapshot. Schemas using it need toJSON: { getters: true }
  if (euros == null || euros === "") return euros // let required answer (Number(null) would be 0)
  const cents = Number(euros + "e2")   // "1.005e2" moves the decimal point inside the string: exactly 100.5
  return cents < 0 ? cents : Math.round(cents) // negatives stay as they are -0.004 must not round to 0 and pass min
}

export const centsToEuros = (cents) => (cents == null ? cents : cents / 100)

export const priceField = () => ({ // Schema field: euros in, cents stored, euros out. The setter always stores whole cents: no integer validator needed
  type: Number,
  required: true,
  min: [0, "{PATH} can't be negative"],
  set: eurosToCents,
  get: centsToEuros,
})
