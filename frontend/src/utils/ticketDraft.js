/* 
* The ticket being written, kept per table in sessionStorage: it survives a reload or a trip back to the tables, not a closed tab,
* sessionStorage can throw (private mode, blocked storage): then the draft lasts only while the page is open
*/
const draftKey = (tableNumber) => `comanda_draft_table_${tableNumber}`

const isValidLine = (line) =>
  line && typeof line.key === 'string' && typeof line.dishId === 'string' &&
  Number.isInteger(line.qty) && line.qty >= 1 && line.qty <= 99 && typeof line.notes === 'string'

export const readDraft = (tableNumber) => { // [{ key, dishId, qty, notes }], [] when missing or broken
  try {
    const lines = JSON.parse(sessionStorage.getItem(draftKey(tableNumber)))
    return Array.isArray(lines) ? lines.filter(isValidLine) : []
  } catch {
    return []
  }
}

export const saveDraft = (tableNumber, lines) => {
  try {
    if (lines.length === 0) sessionStorage.removeItem(draftKey(tableNumber))
    else sessionStorage.setItem(draftKey(tableNumber), JSON.stringify(lines))
  } catch {
    // storage unavailable or full: the draft stays in memory only
  }
}

export const clearDraft = (tableNumber) => {
  try {
    sessionStorage.removeItem(draftKey(tableNumber))
  } catch {
    // nothing to clear
  }
}
