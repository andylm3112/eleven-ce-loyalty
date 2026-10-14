import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  AGENDA,
  TABLAS,
  diasDisponibles,
  fechaISO,
  fechaLarga,
  horasLibres,
  type Barbero,
  type Ocupada,
  type Servicio,
} from '../lib/agenda'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

interface Confirmada {
  fecha: string
  hora: string
  nombre: string
}

const opcion = (activo: boolean) =>
  `rounded border px-4 py-3 text-left transition ${
    activo ? 'bg-light text-primary border-light font-bold' : 'bg-primary border-secondary/60 hover:border-light'
  }`

export default function AgendaCliente() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [barberos, setBarberos] = useState<Barbero[]>([])
  const [ocupadas, setOcupadas] = useState<Ocupada[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [barbero, setBarbero] = useState<Barbero | null>(null)
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<Confirmada | null>(null)

  const dias = useMemo(() => diasDisponibles(), [])
  const hoy = fechaISO(new Date())

  useEffect(() => {
    void (async () => {
      const [s, b] = await Promise.all([
        supabase.from(TABLAS.servicios).select('*').eq('activo', true).order('precio'),
        supabase.from(TABLAS.barberos).select('*').eq('activo', true).order('nombre'),
      ])
      if (s.error || b.error) {
        setError('No se pudo cargar la información. Intenta de nuevo.')
      } else {
        setServicios(s.data as Servicio[])
        setBarberos(b.data as Barbero[])
      }
      setLoading(false)
    })()
  }, [])

  const ultimaConsulta = useRef('')

  const cargarOcupadas = async (barberoId: string, f: string) => {
    const clave = `${barberoId}|${f}`
    ultimaConsulta.current = clave
    const { data, error: e } = await supabase
      .from(TABLAS.ocupadas)
      .select('hora, duracion_min')
      .eq('barbero_id', barberoId)
      .eq('fecha', f)
    if (ultimaConsulta.current !== clave) return // llegó una respuesta vieja
    if (e) {
      setError('No se pudo cargar la disponibilidad.')
      return
    }
    setOcupadas((data || []) as Ocupada[])
  }

  const elegirBarbero = (b: Barbero) => {
    setBarbero(b)
    setHora('')
    if (fecha) void cargarOcupadas(b.id, fecha)
  }

  const elegirFecha = (f: string) => {
    setFecha(f)
    setHora('')
    if (barbero) void cargarOcupadas(barbero.id, f)
  }

  const horas = useMemo(
    () => (servicio && fecha ? horasLibres(fecha, servicio.duracion_min, ocupadas) : []),
    [servicio, fecha, ocupadas],
  )

  const telDigitos = telefono.replace(/\D/g, '')
  const puedeEnviar = Boolean(
    servicio && barbero && fecha && hora && nombre.trim().length > 1 && telDigitos.length >= 10 && telDigitos.length <= 15,
  )

  const confirmar = async () => {
    if (!puedeEnviar || !servicio || !barbero) return
    setEnviando(true)
    setError(null)
    // El id se genera aquí: los clientes no pueden leer la tabla de citas, así que no se pide el registro de vuelta.
    const { error: e } = await supabase.from(TABLAS.citas).insert({
      id: crypto.randomUUID(),
      barbero_id: barbero.id,
      servicio_id: servicio.id,
      cliente_nombre: nombre.trim(),
      cliente_telefono: telDigitos,
      fecha,
      hora,
      duracion_min: servicio.duracion_min,
    })
    setEnviando(false)
    if (e) {
      setError(
        e.code === '23505' || e.code === '23P01' // horario ya tomado o empalmado con otra cita
          ? 'Ese horario acaba de ser tomado. Elige otro.'
          : 'No se pudo guardar la cita. Intenta de nuevo.',
      )
      await cargarOcupadas(barbero.id, fecha)
      setHora('')
      return
    }
    setListo({ fecha, hora, nombre: nombre.trim() })
  }

  const reiniciar = () => {
    setListo(null)
    setServicio(null)
    setBarbero(null)
    setFecha('')
    setHora('')
    setNombre('')
    setTelefono('')
  }

  if (loading) {
    return (
      <div className="min-h-screen text-light flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-secondary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (listo && servicio && barbero) {
    const msg = encodeURIComponent(
      `Hola, agendé una cita en ELEVEN CE STUDIOS: ${servicio.nombre} con ${barbero.nombre}, ${fechaLarga(listo.fecha)} a las ${listo.hora}. A nombre de ${listo.nombre}.`,
    )
    return (
      <div className="min-h-screen text-light flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img src="/no_bg_image.png" alt="ELEVEN CE STUDIOS" className="h-20 mx-auto mb-4" />
            <p className="text-gray-400">Tu cita está confirmada</p>
          </div>
          <div className="bg-primary/90 border border-secondary rounded-lg p-8 shadow-primary text-center">
            <p className="text-2xl font-bold">Listo, {listo.nombre.split(' ')[0]}</p>
            <p className="mt-4 text-lg">{fechaLarga(listo.fecha).replace(/^./, (c) => c.toUpperCase())}</p>
            <p className="text-5xl font-bold my-2">{listo.hora}</p>
            <p className="text-gray-300">
              {servicio.nombre} con {barbero.nombre}
            </p>
            <a
              href={`https://wa.me/${AGENDA.whatsapp}?text=${msg}`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block w-full bg-secondary hover:bg-secondary/80 text-light font-bold py-3 rounded transition"
            >
              Avisar por WhatsApp
            </a>
            <button onClick={reiniciar} className="mt-4 w-full py-2 text-gray-300 hover:underline text-sm">
              Agendar otra cita
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-light flex items-start justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/no_bg_image.png" alt="ELEVEN CE STUDIOS" className="h-20 mx-auto mb-4" />
          <p className="text-gray-400">Agenda tu cita</p>
        </div>

        <div className="bg-primary/90 border border-secondary rounded-lg p-8 shadow-primary">
          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <h2 className="text-sm font-medium mb-2">Servicio</h2>
          <div className="grid gap-2 mb-6">
            {servicios.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServicio(s)
                  setHora('')
                }}
                aria-pressed={servicio?.id === s.id}
                className={`${opcion(servicio?.id === s.id)} flex justify-between`}
              >
                <span>
                  {s.nombre} <span className="opacity-70 text-sm">({s.duracion_min} min)</span>
                </span>
                <span>${s.precio}</span>
              </button>
            ))}
          </div>

          {servicio && (
            <>
              <h2 className="text-sm font-medium mb-2">Barbero</h2>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {barberos.map((b) => (
                  <button key={b.id} onClick={() => elegirBarbero(b)} aria-pressed={barbero?.id === b.id} className={opcion(barbero?.id === b.id)}>
                    {b.nombre}
                  </button>
                ))}
              </div>
            </>
          )}

          {servicio && barbero && (
            <>
              <h2 className="text-sm font-medium mb-2">Día</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
                {dias.map((d) => {
                  const iso = fechaISO(d)
                  return (
                    <button
                      key={iso}
                      onClick={() => elegirFecha(iso)}
                      aria-pressed={fecha === iso}
                      className={`${opcion(fecha === iso)} min-w-[64px] shrink-0 text-center`}
                    >
                      <div className="text-xs">{iso === hoy ? 'Hoy' : DIAS[d.getDay()]}</div>
                      <div className="text-xl">{d.getDate()}</div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {servicio && barbero && fecha && (
            <>
              <h2 className="text-sm font-medium mb-2">Hora</h2>
              {horas.length === 0 ? (
                <p className="text-gray-400 mb-6">No quedan horarios este día con {barbero.nombre}. Prueba otro día u otro barbero.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {horas.map((h) => (
                    <button key={h} onClick={() => setHora(h)} aria-pressed={hora === h} className={`${opcion(hora === h)} text-center px-0`}>
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {hora && (
            <>
              <div className="mb-6">
                <label htmlFor="agenda-nombre" className="block text-sm font-medium mb-2">
                  Nombre
                </label>
                <input
                  id="agenda-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                  className="w-full px-4 py-3 bg-primary border border-secondary/60 rounded focus:border-secondary focus:outline-none text-light"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="agenda-telefono" className="block text-sm font-medium mb-2">
                  Teléfono
                </label>
                <input
                  id="agenda-telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  autoComplete="tel"
                  className="w-full px-4 py-3 bg-primary border border-secondary/60 rounded focus:border-secondary focus:outline-none text-light"
                />
                <p className="text-xs text-zinc-500 mt-2">10 dígitos</p>
              </div>
            </>
          )}

          <button
            onClick={() => void confirmar()}
            disabled={!puedeEnviar || enviando}
            className="w-full bg-secondary hover:bg-secondary/80 text-light font-bold py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? 'Guardando...' : 'Confirmar cita'}
          </button>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-gray-300 hover:underline text-sm">
            ← Volver a inicio
          </a>
        </div>
      </div>
    </div>
  )
}
