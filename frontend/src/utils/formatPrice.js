const euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })

const formatPrice = (value) => euros.format(value) // the API sends euros (5.6) --> "5,60 €"

export default formatPrice
