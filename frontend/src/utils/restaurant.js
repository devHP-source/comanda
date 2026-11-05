// Contact details for /info. Fixed data (not in Settings): change them here
const restaurant = {
  street: 'Via Giovanni Giolitti, 40',
  city: '00185 Rome, RM Italy',
  phone: '+3901234567890',
  phoneDisplay: '+39 012 3456 7890',
}

// Opens the Maps app on phones, Google Maps in the browser elsewhere
export const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Comanda, ${restaurant.street}, ${restaurant.city}`)}`

export default restaurant
