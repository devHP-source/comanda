const ITALY = { region: 'IT', prefix: '+39' }

const FOREIGN_PREFIXES = [ // region: the ISO code, for the country name in the guest's language
  { region: 'AR', prefix: '+54' },
  { region: 'AT', prefix: '+43' },
  { region: 'AU', prefix: '+61' },
  { region: 'BE', prefix: '+32' },
  { region: 'BR', prefix: '+55' },
  { region: 'CA', prefix: '+1' },
  { region: 'CH', prefix: '+41' },
  { region: 'CN', prefix: '+86' },
  { region: 'CZ', prefix: '+420' },
  { region: 'DE', prefix: '+49' },
  { region: 'DK', prefix: '+45' },
  { region: 'ES', prefix: '+34' },
  { region: 'FI', prefix: '+358' },
  { region: 'FR', prefix: '+33' },
  { region: 'GB', prefix: '+44' },
  { region: 'GR', prefix: '+30' },
  { region: 'HR', prefix: '+385' },
  { region: 'HU', prefix: '+36' },
  { region: 'IE', prefix: '+353' },
  { region: 'IL', prefix: '+972' },
  { region: 'IN', prefix: '+91' },
  { region: 'JP', prefix: '+81' },
  { region: 'KR', prefix: '+82' },
  { region: 'LU', prefix: '+352' },
  { region: 'MX', prefix: '+52' },
  { region: 'NL', prefix: '+31' },
  { region: 'NO', prefix: '+47' },
  { region: 'NZ', prefix: '+64' },
  { region: 'PL', prefix: '+48' },
  { region: 'PT', prefix: '+351' },
  { region: 'RO', prefix: '+40' },
  { region: 'SE', prefix: '+46' },
  { region: 'SI', prefix: '+386' },
  { region: 'TR', prefix: '+90' },
  { region: 'TW', prefix: '+886' },
  { region: 'UA', prefix: '+380' },
  { region: 'US', prefix: '+1' },
]

export const DEFAULT_REGION = ITALY.region
export const OTHER_REGION = 'OTHER' // the guest types the whole international number

const INTERNATIONAL_NUMBER = /^\+[1-9]\d{7,14}$/ // "+" and 8-15 digits, country code included

// Italy as default, then alphabetical in the guest's language. The value is the region, not the prefix: USA and Canada share +1
export const phoneOptions = (lang) => {
  const names = new Intl.DisplayNames([lang], { type: 'region' })
  const toOption = ({ region, prefix }) => ({ region, label: `${names.of(region)} (${prefix})` })
  const foreign = FOREIGN_PREFIXES.map(toOption).sort((a, b) => a.label.localeCompare(b.label, lang))
  return [toOption(ITALY), ...foreign]
}

// ("GB", "07911 123456") → "+447911123456"; ("OTHER", "+31 6 12345678") → "+31612345678". null when it can't be a phone number
export const toE164 = (region, number) => {
  const compact = number.replace(/\s/g, '')
  if (region === OTHER_REGION) return INTERNATIONAL_NUMBER.test(compact) ? compact : null
  if (!/^\d+$/.test(compact)) return null

  const { prefix } = region === ITALY.region ? ITALY : FOREIGN_PREFIXES.find((option) => option.region === region)
  const subscriber = region === ITALY.region ? compact : compact.replace(/^0/, '') // Italian landlines keep the 0 in the international format, elsewhere it's only the national trunk prefix
  const total = prefix.length - 1 + subscriber.length
  return total >= 6 && total <= 15 ? `${prefix}${subscriber}` : null
}
