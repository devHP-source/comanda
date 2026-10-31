import Settings from "../models/Settings.js"

// The only way to read the settings: returns the single document, creating it with the schema defaults if missing
export const getSettings = async () => {
  const settings = await Settings.findOne()
  if (settings) return settings
  return Settings.create({})
}
