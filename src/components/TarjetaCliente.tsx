import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { celebrar, useNumeroAnimado, vibrar } from '../lib/animaciones'
import { Aviso } from './Aviso'
import { useAviso } from '../lib/useAviso'
import type { Cliente, CuponCliente } from '../types'

interface Props {
  cliente: Cliente
  onVolver: () => void
}

const PUNTOS_META = 10
const DIAS_EXPIRACION = 30
// Respaldo por si Supabase Realtime no está activo: se revisa cada pocos segundos
const INTERVALO_REVISION_MS = 5000

function pseudoRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function cuponesVigentes(data: CuponCliente[] | null): CuponCliente[] {
  const hoy = new Date()
  return (data ?? []).filter((c) => !c.fecha_expiracion || new Date(c.fecha_expiracion) > hoy)
}

export default function TarjetaCliente({ cliente: clienteInicial, onVolver }: Props) {
  const [cliente, setCliente] = useState(clienteInicial)
  const [cupones, setCupones] = useState<CuponCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [mensajeExpiracion, setMensajeExpiracion] = useState<string | null>(null)
  // Al abrir, las estrellas entran una por una; después, solo la nueva se anima
  const [entradaInicial, setEntradaInicial] = useState(true)
  const { aviso, mostrar, cerrar } = useAviso()

  const puntosPrevios = useRef(clienteInicial.puntos || 0)
  const cuponesPrevios = useRef<Set<string> | null>(null)

  // ---- Cambios que llegan mientras la tarjeta está abierta ----

  const aplicarCliente = useCallback(
    (nuevo: Cliente) => {
      const antes = puntosPrevios.current
      const ahora = nuevo.puntos || 0
      puntosPrevios.current = ahora
      setCliente(nuevo)

      if (ahora > antes) {
        vibrar(ahora >= PUNTOS_META ? [60, 60, 120] : 50)
        if (ahora >= PUNTOS_META) {
          celebrar('premio')
          mostrar('🏆 ¡Completaste tu tarjeta! Canjea tu corte gratis', 'premio')
        } else {
          celebrar('visita')
          const faltan = PUNTOS_META - ahora
          mostrar(`⭐ ¡Visita sumada! Llevas ${ahora}/${PUNTOS_META}. Te ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`}`, 'exito')
        }
      } else if (ahora === 0 && antes >= PUNTOS_META) {
        celebrar('premio')
        vibrar([60, 60, 120])
        mostrar('✂️ ¡Disfruta tu corte gratis! Empieza una nueva vuelta', 'premio')
      }
    },
    [mostrar]
  )

  const aplicarCupones = useCallback(
    (lista: CuponCliente[]) => {
      const ids = new Set(lista.map((c) => c.id))
      const previos = cuponesPrevios.current
      cuponesPrevios.current = ids
      setCupones(lista)

      if (!previos) return // primera carga: sin avisos
      const nuevos = lista.filter((c) => !previos.has(c.id))
      if (nuevos.length > 0) {
        celebrar('premio')
        vibrar([60, 60, 120])
        mostrar(`🎁 ¡Ganaste: ${nuevos.map((c) => c.cupones.nombre).join(', ')}!`, 'premio')
        return
      }
      const canjeados = [...previos].filter((id) => !ids.has(id)).length
      if (canjeados > 0 && puntosPrevios.current !== 0) {
        mostrar('🎁 Cupón canjeado. ¡Disfrútalo!', 'exito')
      }
    },
    [mostrar]
  )

  const cargarCupones = useCallback(async () => {
    const { data, error } = await supabase
      .from('cupones_clientes')
      .select('*, cupones(*)')
      .eq('cliente_id', clienteInicial.id)
      .eq('canjeado', false)
      .order('fecha_obtencion', { ascending: true })

    if (!error) aplicarCupones(cuponesVigentes(data as CuponCliente[]))
  }, [clienteInicial.id, aplicarCupones])

  const recargarCliente = useCallback(async () => {
    const { data, error } = await supabase.from('clientes').select('*').eq('id', clienteInicial.id).maybeSingle()
    if (!error && data) aplicarCliente(data as Cliente)
  }, [clienteInicial.id, aplicarCliente])

  // ---- Carga inicial ----

  useEffect(() => {
    let cancelado = false

    const iniciar = async () => {
      try {
        // Caducidad: más de 30 días sin visitar reinicia los puntos
        if (clienteInicial.ultima_visita && clienteInicial.puntos > 0) {
          const dias = Math.floor((Date.now() - new Date(clienteInicial.ultima_visita).getTime()) / 86_400_000)
          if (dias > DIAS_EXPIRACION) {
            const { data } = await supabase
              .from('clientes')
              .update({ puntos: 0 })
              .eq('id', clienteInicial.id)
              .select()
              .single()
            if (data && !cancelado) {
              puntosPrevios.current = 0
              setCliente(data as Cliente)
              setMensajeExpiracion('Tus puntos expiraron por inactividad. ¡Empieza de nuevo!')
            }
          }
        }
        await cargarCupones()
      } catch (error) {
        console.error('Error cargando datos:', error)
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    void iniciar()
    const t = window.setTimeout(() => setEntradaInicial(false), 1800)
    return () => {
      cancelado = true
      window.clearTimeout(t)
    }
  }, [clienteInicial, cargarCupones])

  // Tarjeta ya completa al abrir: pequeña celebración
  useEffect(() => {
    if (!loading && (clienteInicial.puntos || 0) >= PUNTOS_META) {
      const t = window.setTimeout(() => celebrar('visita'), 700)
      return () => window.clearTimeout(t)
    }
  }, [loading, clienteInicial.puntos])

  // ---- Tiempo real: el barbero escanea y la tarjeta reacciona al instante ----

  useEffect(() => {
    const canal = supabase
      .channel(`tarjeta-${clienteInicial.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clientes', filter: `id=eq.${clienteInicial.id}` },
        (payload) => aplicarCliente(payload.new as Cliente)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cupones_clientes', filter: `cliente_id=eq.${clienteInicial.id}` },
        () => void cargarCupones()
      )
      .subscribe()

    // Respaldo: revisar periódicamente mientras la pantalla está visible
    const revisar = () => {
      if (document.visibilityState !== 'visible') return
      void recargarCliente()
      void cargarCupones()
    }
    const intervalo = window.setInterval(revisar, INTERVALO_REVISION_MS)
    document.addEventListener('visibilitychange', revisar)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', revisar)
      void supabase.removeChannel(canal)
    }
  }, [clienteInicial.id, aplicarCliente, cargarCupones, recargarCliente])

  // ---- Presentación ----

  const puntos = Math.min(cliente.puntos || 0, PUNTOS_META)
  const puntosMostrados = useNumeroAnimado(puntos)
  const completa = puntos >= PUNTOS_META
  const faltan = PUNTOS_META - puntos
  const qrUrl = `${import.meta.env.VITE_APP_DOMAIN}/scan/${cliente.id}`

  const estrellasStyles = useMemo(() => {
    return Array.from({ length: PUNTOS_META }, (_, i) => {
      const seed = cliente.id.charCodeAt(0) + i * 31
      const rotation = -15 + pseudoRandom(seed) * 30
      const scale = 0.9 + pseudoRandom(seed + 7) * 0.2
      return { rotation, scale }
    })
  }, [cliente.id])

  const calcularDiasRestantes = (fechaExpiracion: string) => {
    const dias = Math.ceil((new Date(fechaExpiracion).getTime() - Date.now()) / 86_400_000)
    return dias > 0 ? dias : 0
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6" aria-busy="true" aria-label="Cargando tu tarjeta">
        <div className="max-w-md mx-auto">
          <div className="esqueleto h-24 w-40 mx-auto mb-8" />
          <div className="tarjeta-vidrio p-8 mb-6">
            <div className="esqueleto h-9 w-2/3 mx-auto mb-3" />
            <div className="esqueleto h-4 w-1/3 mx-auto mb-8" />
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {Array.from({ length: PUNTOS_META }, (_, i) => (
                <div key={i} className="esqueleto h-12 w-12 rounded-full" />
              ))}
            </div>
            <div className="esqueleto h-52 w-52 mx-auto rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-light p-6">
      <Aviso aviso={aviso} onCerrar={cerrar} />

      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6 animate-entrar-arriba">
          <img src="/no_bg_image.png" alt="ELEVEN CE STUDIOS" className="h-24 mx-auto animate-flotar" />
          <p className="text-gray-400 mt-2 tracking-wide">Tarjeta de Fidelidad</p>
        </div>

        {/* Tarjeta principal */}
        <div
          className={`relative overflow-hidden bg-gradient-to-br from-primary/95 to-primary border-2 rounded-2xl p-8 mb-6
            animate-entrar-arriba transition-[border-color,box-shadow] duration-700 ease-suave
            ${completa ? 'border-oro/80 shadow-oro' : 'border-secondary shadow-primary-lg'}`}
          style={{ animationDelay: '80ms' }}
        >
          {/* Nombre y teléfono */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">{cliente.nombre}</h2>
            <p className="text-gray-400">Tel: {cliente.telefono}</p>
          </div>

          {/* Mensaje de expiración */}
          {mensajeExpiracion && (
            <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500 rounded-lg text-yellow-200 text-sm text-center animate-entrar-escala">
              {mensajeExpiracion}
            </div>
          )}

          {/* Progreso */}
          <div className="mb-8">
            <p className="text-center text-2xl font-bold mb-4 text-oro" aria-live="polite">
              Has sido elevado a <span className="tabular-nums">{puntosMostrados}</span>{' '}
              {puntosMostrados === 1 ? 'estrella' : 'estrellas'}
            </p>

            <div className="flex gap-2 flex-wrap justify-center items-center min-h-[4rem]">
              {estrellasStyles.map(({ rotation, scale }, i) =>
                i < puntos ? (
                  <span
                    key={`estrella-${i}`}
                    className="inline-block animate-estrella-pop"
                    style={{ animationDelay: entradaInicial ? `${200 + i * 70}ms` : '0ms' }}
                  >
                    <img
                      src="/no_bg_image (1).png"
                      alt={`Estrella ${i + 1}`}
                      className="w-16 h-16 object-contain drop-shadow-[0_0_8px_rgba(212,175,55,0.35)]"
                      style={{ transform: `rotate(${rotation.toFixed(1)}deg) scale(${scale.toFixed(2)})` }}
                    />
                  </span>
                ) : (
                  <span
                    key={`pendiente-${i}`}
                    className="w-4 h-4 rounded-full bg-gray-500/70 animate-entrar-escala"
                    style={{ animationDelay: entradaInicial ? `${200 + i * 50}ms` : '0ms' }}
                  />
                )
              )}
            </div>

            {/* Barra de progreso hacia el corte gratis */}
            <div className="mt-6">
              <div
                className="h-2 rounded-full bg-white/10 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={PUNTOS_META}
                aria-valuenow={puntos}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-oro/70 to-oro transition-[width] duration-1000 ease-suave"
                  style={{ width: `${(puntos / PUNTOS_META) * 100}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-300 mt-2">
                {completa
                  ? '🏆 ¡Tarjeta completa! Muestra tu QR para canjear tu corte gratis'
                  : faltan === 1
                    ? '¡Solo te falta 1 visita para tu corte gratis!'
                    : `Te faltan ${faltan} visitas para tu corte gratis`}
              </p>
            </div>
          </div>

          {/* QR Code */}
          <div className="mb-4">
            <div
              className={`bg-white p-6 rounded-xl mx-auto w-fit transition-transform duration-300 ease-suave hover:scale-[1.02] ${
                completa ? 'animate-latido' : ''
              }`}
            >
              <QRCodeCanvas value={qrUrl} size={200} level="H" includeMargin={false} />
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              Muestra este código en tu próxima visita. Tu tarjeta se actualiza sola.
            </p>
          </div>
        </div>

        {/* Cupones activos */}
        {cupones.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold text-light mb-3 animate-entrar-arriba">🎁 Cupones Disponibles</h3>
            {cupones.map((cupon, i) => (
              <div
                key={cupon.id}
                className="con-brillo relative overflow-hidden bg-primary/90 border border-oro/50 rounded-xl p-4 mb-3 shadow-oro animate-entrar-escala"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-lg">{cupon.cupones.nombre}</h4>
                  <span className="text-xs bg-oro text-primary px-3 py-1 rounded-full font-bold">
                    {cupon.cupones.tipo === '2x1' ? '2x1' : 'GRATIS'}
                  </span>
                </div>
                {cupon.cupones.descripcion && <p className="text-gray-400 text-sm mb-2">{cupon.cupones.descripcion}</p>}
                {cupon.fecha_expiracion && (
                  <p className="text-xs text-yellow-400">⏰ Expira en {calcularDiasRestantes(cupon.fecha_expiracion)} días</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botón volver */}
        <button onClick={onVolver} className="boton-principal w-full animate-entrar-arriba" style={{ animationDelay: '160ms' }}>
          ← Nueva búsqueda
        </button>
      </div>
    </div>
  )
}
