// Configuración y utilidades de la agenda de citas de ELEVEN CE STUDIOS.
// Ajusta el horario aquí; los servicios y barberos se editan en Supabase (tablas eleven_servicios / eleven_barberos).

export const AGENDA = {
  whatsapp: '526623885602', // código de país + número, sin + ni espacios
  apertura: '10:00',
  cierre: '20:00',
  pasoMin: 30,
  diasCerrado: [0], // 0 = domingo ... 6 = sábado
  diasAdelante: 21,
}

export const TABLAS = {
  servicios: 'eleven_servicios',
  barberos: 'eleven_barberos',
  citas: 'eleven_citas',
  ocupadas: 'eleven_citas_ocupadas', // vista sin datos personales, solo horarios tomados
}

export interface Servicio {
  id: string
  nombre: string
  duracion_min: number
  precio: number
}

export interface Barbero {
  id: string
  nombre: string
}

export interface Ocupada {
  hora: string
  duracion_min: number
}

export interface Cita {
  id: string
  barbero_id: string
  servicio_id: string | null
  cliente_nombre: string
  cliente_telefono: string
  fecha: string
  hora: string
  duracion_min: number
  estado: 'confirmada' | 'cancelada'
}

export const aMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const aHHMM = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export const fechaISO = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const fechaLarga = (iso: string): string =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

export const diasDisponibles = (): Date[] => {
  const out: Date[] = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = 0; i < AGENDA.diasAdelante; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    if (!AGENDA.diasCerrado.includes(d.getDay())) out.push(d)
  }
  return out
}

export const horasLibres = (fecha: string, duracion: number, ocupadas: Ocupada[]): string[] => {
  const ini = aMin(AGENDA.apertura)
  const fin = aMin(AGENDA.cierre)
  const ahora = new Date()
  const esHoy = fecha === fechaISO(ahora)
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const rangos = ocupadas.map((o) => {
    const a = aMin(o.hora.slice(0, 5))
    return [a, a + o.duracion_min] as const
  })

  const out: string[] = []
  for (let t = ini; t + duracion <= fin; t += AGENDA.pasoMin) {
    if (esHoy && t <= minAhora) continue
    if (!rangos.some(([a, b]) => t < b && t + duracion > a)) out.push(aHHMM(t))
  }
  return out
}

export const telefonoWhatsApp = (tel: string): string => {
  const d = tel.replace(/\D/g, '')
  return d.length === 10 ? `52${d}` : d
}
