import { useContext } from 'react'
import { ListContext } from '../context/ListContext.js'

const useList = () => {
  const context = useContext(ListContext)
  if (!context) throw new Error('useList must be used inside <ListProvider>')
  return context
}

export default useList
