import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'
import { supabase } from '../lib/supabase'
import { TABLAS, fechaISO, fechaLarga, telefonoWhatsApp, type Barbero, type Cita, type Servicio } from '../lib/agenda'

export default function AgendaAdmin() {
  const { admin, loading: adminLoading } = useAdmin()
  const navigate = useNavigate()

  const [fecha, setFecha] = useState(fechaISO(new Date()))
  const [citas, setCitas] = useState<Cita[]>([])
  const [servicios, setServicios] = useState<Record<string, Servicio>>({})
  const [barberos, setBarberos] = useState<Record<string, Barbero>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [recienCancelada, setRecienCancelada] = useState<Cita | null>(null)

  useEffect(() => {
    if (!adminLoading && !admin) {
      sessionStorage.setItem('redirect_after_login', '/admin/agenda')
      navigate('/login')
    }
  }, [admin, adminLoading, navigate])

  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!admin) return
    let vigente = true
    void (async () => {
      const [c, s, b] = await Promise.all([
        supabase.from(TABLAS.citas).select('*').eq('fecha', fecha).order('hora'),
        supabase.from(TABLAS.servicios).select('*'),
        supabase.from(TABLAS.barberos).select('*'),
      ])
      if (!vigente) return
      if (c.error || s.error || b.error) {
        setError('No se pudieron cargar las citas.')
      } else {
        setError(null)
        setCitas(c.data as Cita[])
        setServicios(Object.fromEntries((s.data as Servicio[]).map((x) => [x.id, x])))
        setBarberos(Object.fromEntries((b.data as Barbero[]).map((x) => [x.id, x])))
      }
      setLoading(false)
    })()
    return () => {
      vigente = false
    }
  }, [admin, fecha, recarga])

  const mensajeCancelacion = (c: Cita) => {
    const servicio = (c.servicio_id && servicios[c.servicio_id]?.nombre) || 'servicio'
    const dia = fechaLarga(c.fecha).replace(/^./, (x) => x.toUpperCase())
    return encodeURIComponent(
      `Hola ${c.cliente_nombre}, te escribimos de ELEVEN CE STUDIOS. Tuvimos que cancelar tu cita de ${servicio} del ${dia} a las ${c.hora.slice(0, 5)}. Queremos explicarte el motivo y buscar otro horario que te funcione.`,
    )
  }

  const cancelar = async (c: Cita) => {
    if (!window.confirm(`¿Cancelar la cita de ${c.cliente_nombre}?`)) return
    setOcupado(true)
    setError(null)
    const { data, error: e } = await supabase.rpc('eleven_cancelar_cita', { p_id: c.id })
    setTimeout(() => setOcupado(false), 1500)
    if (e) {
      setError(`No se pudo cancelar la cita: ${e.message}`)
      return
    }
    if (data === false) {
      setError('Esa cita ya estaba cancelada.')
      setRecarga((n) => n + 1)
      return
    }
    setRecienCancelada({ ...c, estado: 'cancelada' })
    setRecarga((n) => n + 1)
  }

  if (adminLoading || (admin && loading)) {
    return (
      <div className="min-h-screen text-light flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-secondary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!admin) return null

  const activas = citas.filter((c) => c.estado === 'confirmada').length

  return (
    <div className="min-h-screen text-light p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <img src="/no_bg_image.png" alt="ELEVEN CE STUDIOS" className="h-24" />
            <p className="text-gray-400 mt-2">Agenda de citas</p>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-2 bg-secondary hover:bg-secondary/80 rounded transition font-bold"
          >
            ← Panel
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="px-4 py-2 bg-primary border border-secondary/60 rounded text-light [color-scheme:dark]"
          />
          <button onClick={() => setFecha(fechaISO(new Date()))} className="px-4 py-2 border border-secondary/60 rounded font-bold">
            Hoy
          </button>
          <span className="ml-auto text-lg font-bold">
            {activas} {activas === 1 ? 'cita' : 'citas'}
          </span>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        {recienCancelada && (
          <div className="mb-6 p-5 bg-primary/90 border border-light/60 rounded-lg shadow-primary">
            <p className="text-lg font-bold">Cita cancelada</p>
            <p className="mt-1 text-sm text-gray-300">
              ¿Quieres avisarle a {recienCancelada.cliente_nombre} por WhatsApp y explicarle el motivo?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${telefonoWhatsApp(recienCancelada.cliente_telefono)}?text=${mensajeCancelacion(recienCancelada)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded font-bold transition"
              >
                Avisar por WhatsApp
              </a>
              <button
                onClick={() => setRecienCancelada(null)}
                className="px-4 py-2 border border-secondary/60 rounded font-bold"
              >
                Ahora no
              </button>
            </div>
          </div>
        )}

        {citas.length === 0 ? (
          <div className="bg-primary/90 border border-secondary rounded-lg p-6 shadow-primary text-gray-400">
            No hay citas este día.
          </div>
        ) : (
          <ul className="grid gap-3">
            {citas.map((c) => {
              const cancelada = c.estado === 'cancelada'
              const msg = encodeURIComponent(
                `Hola ${c.cliente_nombre}, te recordamos tu cita en ELEVEN CE STUDIOS el ${c.fecha} a las ${c.hora.slice(0, 5)}.`,
              )
              return (
                <li
                  key={c.id}
                  className={`bg-primary/90 border border-secondary rounded-lg p-5 shadow-primary ${cancelada ? 'opacity-50' : ''}`}
                >
                  <div className="flex justify-between items-baseline">
                    <span className={`text-3xl font-bold ${cancelada ? 'line-through' : ''}`}>{c.hora.slice(0, 5)}</span>
                    <span className="font-bold">{barberos[c.barbero_id]?.nombre}</span>
                  </div>
                  <p className="mt-1 text-lg font-bold">{c.cliente_nombre}</p>
                  <p className="text-sm text-gray-400">
                    {(c.servicio_id && servicios[c.servicio_id]?.nombre) || 'Servicio'}, {c.duracion_min} min, {c.cliente_telefono}
                  </p>
                  {cancelada ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="text-sm text-red-300 font-bold">Cancelada</span>
                      <a
                        href={`https://wa.me/${telefonoWhatsApp(c.cliente_telefono)}?text=${mensajeCancelacion(c)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded text-sm font-bold transition"
                      >
                        Avisar por WhatsApp
                      </a>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`https://wa.me/${telefonoWhatsApp(c.cliente_telefono)}?text=${msg}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded text-sm font-bold transition"
                      >
                        Recordar por WhatsApp
                      </a>
                      <button
                        onClick={() => void cancelar(c)}
                        disabled={ocupado}
                        className="px-4 py-2 bg-red-900 hover:bg-red-800 rounded text-sm font-bold transition disabled:opacity-50"
                      >
                        Cancelar cita
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
