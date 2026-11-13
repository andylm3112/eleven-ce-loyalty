import { useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'

const COLORES = ['#D4AF37', '#11196d', '#f0f0f0', '#3c4142']

function prefiereMenosMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Confeti pequeño (visita) o celebración grande (premio / tarjeta completa)
export function celebrar(intensidad: 'visita' | 'premio' = 'visita') {
  if (prefiereMenosMovimiento()) return

  if (intensidad === 'visita') {
    confetti({ particleCount: 70, spread: 60, startVelocity: 35, origin: { y: 0.65 }, colors: COLORES })
    return
  }

  const fin = Date.now() + 900
  const rafaga = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORES })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORES })
    if (Date.now() < fin) requestAnimationFrame(rafaga)
  }
  confetti({ particleCount: 140, spread: 90, startVelocity: 45, origin: { y: 0.6 }, colors: COLORES })
  rafaga()
}

// Vibración corta en teléfonos que la soportan (Android); en iPhone no hace nada
export function vibrar(patron: number | number[] = 40) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(patron)
    } catch {
      // algunos navegadores lo bloquean sin interacción previa
    }
  }
}

// Número que sube de forma animada hasta el valor (p. ej. 6 -> 7)
export function useNumeroAnimado(valor: number, duracionMs = 600) {
  const [mostrado, setMostrado] = useState(valor)
  const anterior = useRef(valor)

  useEffect(() => {
    const desde = anterior.current
    anterior.current = valor
    if (desde === valor) return

    // Con "menos movimiento" el cambio es instantáneo (duración 0)
    const duracion = prefiereMenosMovimiento() ? 0 : duracionMs
    const inicio = performance.now()
    let frame = 0
    const paso = (ahora: number) => {
      const t = duracion === 0 ? 1 : Math.min((ahora - inicio) / duracion, 1)
      const suavizado = 1 - Math.pow(1 - t, 3)
      setMostrado(Math.round(desde + (valor - desde) * suavizado))
      if (t < 1) frame = requestAnimationFrame(paso)
    }
    frame = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(frame)
  }, [valor, duracionMs])

  return mostrado
}
