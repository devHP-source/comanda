const normalizeText = (text) => // " Caffè" --> "caffe": search ignores case, accents and outer spaces
  (text ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export default normalizeText
