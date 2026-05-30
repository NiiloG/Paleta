'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface HcCtx { hc: boolean; toggle: () => void }
const Ctx = createContext<HcCtx>({ hc: false, toggle: () => {} })

export function HcProvider({ children }: { children: React.ReactNode }) {
  const [hc, setHc] = useState(false)

  useEffect(() => {
    const on = localStorage.getItem('hc') === '1'
    setHc(on)
    document.documentElement.classList.toggle('hc', on)
  }, [])

  function toggle() {
    setHc(prev => {
      const next = !prev
      localStorage.setItem('hc', next ? '1' : '0')
      document.documentElement.classList.toggle('hc', next)
      return next
    })
  }

  return <Ctx.Provider value={{ hc, toggle }}>{children}</Ctx.Provider>
}

export function useHc() {
  return useContext(Ctx)
}
