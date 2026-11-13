import { useCallback, useEffect, useRef, useState } from 'react'

export type TipoAviso = 'exito' | 'premio' | 'info' | 'error'

export interface AvisoData {
  id: number
  texto: string
  tipo: TipoAviso
}

// Aviso flotante en la parte superior que desaparece solo
export function useAviso(duracionMs = 3800) {
  const [aviso, setAviso] = useState<AvisoData | null>(null)
  const temporizador = useRef<number | undefined>(undefined)

  const mostrar = useCallback(
    (texto: string, tipo: TipoAviso = 'info') => {
      window.clearTimeout(temporizador.current)
      setAviso({ id: Date.now(), texto, tipo })
      temporizador.current = window.setTimeout(() => setAviso(null), duracionMs)
    },
    [duracionMs]
  )

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  const cerrar = useCallback(() => setAviso(null), [])

  return { aviso, mostrar, cerrar }
}
