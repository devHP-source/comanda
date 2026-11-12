import { useEffect } from 'react'

const BRAND = 'Comanda'

/*
* Sets the browser tab title to "<title> · Comanda" (just "Comanda" without a title).
* Pass an already translated title: it updates when the language changes. On unmount the title goes back to "Comanda"
*/
const useDocumentTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · ${BRAND}` : BRAND

    return () => {
      document.title = BRAND
    }
  }, [title])
}

export default useDocumentTitle
