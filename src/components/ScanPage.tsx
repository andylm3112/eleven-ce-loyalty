import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import confetti from 'canvas-confetti'
import type { Admin, Cliente, CuponCliente } from '../types'

type ClienteConNegocio = Cliente & { negocio_id: string }

// Visitas por vuelta de la tarjeta. Al canjear el premio final, los puntos vuelven a 0.
const PUNTOS_META = 10

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

export default function ScanPage() {
  const { clienteId } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [cuponesCliente, setCuponesCliente] = useState<CuponCliente[]>([])
  const [disabled, setDisabled] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    void verificarYCargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarga al cambiar clienteId
  }, [clienteId])

  async function verificarSesion(): Promise<'login' | 'error' | string> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      setError(`Error al verificar sesión: ${error.message}`)
      return 'error'
    }

    if (!session) {
      sessionStorage.setItem('redirect_after_login', `/scan/${clienteId}`)
      navigate('/login')
      return 'login'
    }

    if (!session.user.email) {
      setError('Tu sesión no tiene email asociado. Vuelve a iniciar sesión.')
      return 'error'
    }

    return session.user.email
  }

  async function verificarAdmin(email: string): Promise<'home' | 'error' | true> {
    const { data, error } = await supabase
      .from('administradores')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.error('Error buscando admin:', error)
      setError(`Error al verificar administrador: ${error.message}`)
      return 'error'
    }

    if (!data) {
      navigate('/')
      return 'home'
    }

    setAdmin(data as Admin)
    return true
  }

  async function cargarClientePorId(id: string): Promise<ClienteConNegocio | null> {
    const { data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle()

    if (error) {
      setError(`Error al buscar cliente: ${error.message}`)
      return null
    }

    if (!data) {
      setError('Cliente no encontrado. Verifica que el QR sea válido.')
      return null
    }

    return data as ClienteConNegocio
  }

  async function verificarYCargar() {
    setLoading(true)
    setError(null)

    if (!clienteId) {
      setError('ID de cliente no válido en la URL.')
      setLoading(false)
      return
    }

    const sesion = await verificarSesion()
    if (sesion === 'login') {
      return
    }
    if (sesion === 'error') {
      setLoading(false)
      return
    }

    const esAdmin = await verificarAdmin(sesion)
    if (esAdmin === 'home') {
      return
    }
    if (esAdmin === 'error') {
      setLoading(false)
      return
    }

    const clienteData = await cargarClientePorId(clienteId)
    if (!clienteData) {
      setLoading(false)
      return
    }

    const clienteVigente = await verificarExpiracionPuntos(clienteData)

    // Reparación: si completó la tarjeta y no tiene el premio final pendiente
    // (p. ej. por el bug anterior), se le entrega ahora para que pueda canjearlo.
    if (clienteVigente.puntos >= PUNTOS_META) {
      const ganados = await otorgarCuponesDeLaVuelta(clienteVigente, PUNTOS_META)
      if (ganados.length > 0) {
        setMensaje(`🎉 Tarjeta completa: se entregó ${ganados.join(', ')}. ¡Ya puede canjearlo!`)
      }
    }

    await cargarCuponesCliente(clienteData.id)

    setLoading(false)
  }

  async function verificarExpiracionPuntos(clienteData: ClienteConNegocio): Promise<ClienteConNegocio> {
    // Obtener configuración del negocio
    const { data: negocio } = await supabase
      .from('negocios')
      .select('dias_expiracion')
      .eq('id', clienteData.negocio_id)
      .single()

    if (!negocio || !negocio.dias_expiracion || !clienteData.ultima_visita) {
      setCliente(clienteData)
      return clienteData
    }

    const hoy = new Date()
    const ultimaVisita = new Date(clienteData.ultima_visita)
    const diasTranscurridos = Math.floor((hoy.getTime() - ultimaVisita.getTime()) / (1000 * 60 * 60 * 24))

    if (diasTranscurridos > negocio.dias_expiracion && clienteData.puntos > 0) {
      // Resetear puntos por expiración
      const { data: clienteActualizado } = await supabase
        .from('clientes')
        .update({ puntos: 0 })
        .eq('id', clienteData.id)
        .select()
        .single()

      const vigente = (clienteActualizado as ClienteConNegocio | null) || { ...clienteData, puntos: 0 }
      setMensaje('⚠️ Los puntos de este cliente expiraron por inactividad')
      setCliente(vigente)
      return vigente
    }

    setCliente(clienteData)
    return clienteData
  }

  async function cargarCuponesCliente(clienteId: string) {
    const { data, error } = await supabase
      .from('cupones_clientes')
      .select(`
        *,
        cupones (
          id,
          nombre,
          descripcion,
          tipo,
          visita_requerida
        )
      `)
      .eq('cliente_id', clienteId)
      .eq('canjeado', false)

    if (!error && data) {
      const hoy = new Date()
      const cuponesActivos = data.filter(cupon => {
        if (!cupon.fecha_expiracion) return true
        return new Date(cupon.fecha_expiracion) > hoy
      })
      setCuponesCliente(cuponesActivos)
    }
  }

  async function handleAddVisit() {
    if (!cliente || !admin) return

    setDisabled(true)
    setMensaje(null)
    setError(null)

    try {
      // Tarjeta llena: primero se canjea el premio final, luego empieza otra vuelta
      if (cliente.puntos >= PUNTOS_META) {
        setError(`🏆 Este cliente ya completó su tarjeta. Canjea su premio para empezar una nueva vuelta.`)
        setTimeout(() => setDisabled(false), 3000)
        return
      }

      // Verificar máximo 1 punto por día
      if (cliente.ultima_visita) {
        const hoy = new Date().toDateString()
        const ultimaVisita = new Date(cliente.ultima_visita).toDateString()
        
        if (hoy === ultimaVisita) {
          setError('⚠️ Ya se sumó una visita hoy. Máximo 1 punto por día.')
          setTimeout(() => setDisabled(false), 3000)
          return
        }
      }

      // Sumar punto
      const nuevosPuntos = cliente.puntos + 1
      const { data: clienteActualizado, error: updateError } = await supabase
        .from('clientes')
        .update({ 
          puntos: nuevosPuntos, 
          ultima_visita: new Date().toISOString() 
        })
        .eq('id', cliente.id)
        .select()
        .single()

      if (updateError) throw updateError

      // Insertar en historial (registro de quién sumó la visita)
      const { error: historialError } = await supabase.from('historial_visitas').insert({
        cliente_id: cliente.id,
        admin_id: admin.id,
        puntos_sumados: 1
      })
      if (historialError) console.error('No se pudo guardar el historial de la visita:', historialError)

      // Premios de esta vuelta: se deciden por los puntos actuales (1 a PUNTOS_META), no por el total histórico
      const ganados = await otorgarCuponesDeLaVuelta(clienteActualizado as ClienteConNegocio, nuevosPuntos)

      setCliente(clienteActualizado)
      setMensaje(
        ganados.length > 0
          ? `✅ Visita añadida. 🎉 ¡Ganó: ${ganados.join(', ')}!`
          : '✅ Visita añadida correctamente'
      )

      if (nuevosPuntos === PUNTOS_META) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3c4142', '#11196d', '#f0f0f0']
        })
      }

      setTimeout(() => {
        setDisabled(false)
        setMensaje(null)
      }, 3000)

    } catch (err: unknown) {
      console.error('Error al añadir visita:', err)
      setError(getErrorMessage(err, 'Error al añadir visita'))
      setTimeout(() => setDisabled(false), 3000)
    }
  }

  // Entrega los cupones cuyo hito coincide con los puntos de la vuelta actual.
  // Un cupón ya canjeado o caducado se puede volver a ganar en la siguiente vuelta;
  // solo se omite si el cliente tiene uno igual pendiente y vigente.
  // Devuelve los nombres de los cupones entregados.
  async function otorgarCuponesDeLaVuelta(clienteData: ClienteConNegocio, puntosVuelta: number): Promise<string[]> {
    const ganados: string[] = []
    const { data: cupones, error: cuponesError } = await supabase
      .from('cupones')
      .select('*')
      .eq('negocio_id', clienteData.negocio_id)
      .eq('visita_requerida', puntosVuelta)
      .eq('activo', true)

    if (cuponesError) {
      console.error('Error buscando cupones:', cuponesError)
      return ganados
    }

    for (const cupon of cupones ?? []) {
      const { data: pendientes, error: pendientesError } = await supabase
        .from('cupones_clientes')
        .select('id, fecha_expiracion')
        .eq('cliente_id', clienteData.id)
        .eq('cupon_id', cupon.id)
        .eq('canjeado', false)

      if (pendientesError) {
        console.error('Error revisando cupones del cliente:', pendientesError)
        continue
      }

      const ahora = new Date()
      const tieneVigente = (pendientes ?? []).some(
        (p) => !p.fecha_expiracion || new Date(p.fecha_expiracion) > ahora
      )
      if (tieneVigente) continue

      const fechaExpiracion = new Date()
      fechaExpiracion.setDate(fechaExpiracion.getDate() + (cupon.dias_validez || 30))

      const { error: insertError } = await supabase.from('cupones_clientes').insert({
        cliente_id: clienteData.id,
        cupon_id: cupon.id,
        fecha_expiracion: fechaExpiracion.toISOString()
      })

      if (insertError) {
        setError(`No se pudo entregar el cupón ${cupon.nombre}: ${insertError.message}`)
        continue
      }

      ganados.push(cupon.nombre)
    }

    if (ganados.length > 0) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#3c4142', '#11196d', '#f0f0f0']
      })
    }

    await cargarCuponesCliente(clienteData.id)
    return ganados
  }

  async function handleCanjearCupon(cuponClienteId: string, cuponId: string, tipo: string) {
    if (!cliente || !admin) return

    setDisabled(true)
    setMensaje(null)
    setError(null)

    try {
      // Marcar cupón como canjeado. Solo si sigue pendiente, para que un doble
      // toque o dos dispositivos no lo canjeen dos veces.
      const { data: marcados, error: canjeError } = await supabase
        .from('cupones_clientes')
        .update({
          canjeado: true,
          fecha_canje: new Date().toISOString()
        })
        .eq('id', cuponClienteId)
        .eq('canjeado', false)
        .select('id')

      if (canjeError) throw canjeError
      if (!marcados || marcados.length === 0) {
        throw new Error('Este cupón ya fue canjeado.')
      }

      // Insertar en historial
      const { error: historialError } = await supabase.from('historial_premios').insert({
        cliente_id: cliente.id,
        admin_id: admin.id,
        cupon_id: cuponId,
        puntos_al_canjear: cliente.puntos
      })
      if (historialError) console.error('No se pudo guardar el historial del premio:', historialError)

      // Premio final de la vuelta (corte gratis): la tarjeta vuelve a 0
      if (tipo === 'producto_gratis') {
        const { data: clienteActualizado, error: resetError } = await supabase
          .from('clientes')
          .update({ puntos: 0 })
          .eq('id', cliente.id)
          .select()
          .single()

        if (resetError) throw resetError
        setCliente(clienteActualizado || { ...cliente, puntos: 0 })
      }

      setMensaje('🎁 ¡Cupón canjeado exitosamente!')
      
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#3c4142', '#11196d', '#f0f0f0']
      })

      // Recargar cupones
      await cargarCuponesCliente(cliente.id)

      setTimeout(() => {
        setDisabled(false)
        setMensaje(null)
      }, 3000)

    } catch (err: unknown) {
      console.error('Error al canjear cupón:', err)
      setError(getErrorMessage(err, 'Error al canjear cupón'))
      setTimeout(() => setDisabled(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen text-light flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-secondary border-t-transparent mx-auto mb-4"></div>
          <p className="text-light">Cargando cliente...</p>
        </div>
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="min-h-screen text-light flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-red-900/20 border-2 border-red-500 rounded-lg p-6 mb-6">
            <p className="text-red-400 text-center">
              {error || 'No se pudo cargar la información del cliente.'}
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/admin')}
              className="w-full bg-secondary hover:bg-secondary/80 text-light font-bold py-3 px-6 rounded-lg transition"
            >
              Volver al Panel
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-secondary hover:bg-secondary/80 text-light font-bold py-3 px-6 rounded-lg transition border border-secondary/60"
            >
              Ir al Inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  const circulos = Array.from({ length: 10 }, (_, i) => i < cliente.puntos)

  return (
    <div className="min-h-screen text-light p-6">
      <div className="max-w-2xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h1 className="font-[Palace Script] text-4xl text-primary mb-2">ELEVEN CE STUDIOS</h1>
          <p className="text-gray-400">Panel de Administrador</p>
        </div>

        {/* Mensajes */}
        {mensaje && (
          <div className="bg-green-900/20 border-2 border-green-500 rounded-lg p-4 mb-6">
            <p className="text-green-400 text-center font-bold">{mensaje}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border-2 border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Tarjeta del Cliente */}
        <div className="bg-gradient-to-br from-primary/95 to-primary border-2 border-secondary rounded-2xl p-8 shadow-primary-lg mb-6">
          {/* Nombre */}
          <div className="text-center mb-6">
            <div className="text-xs text-gray-500 mb-1">CLIENTE</div>
            <h2 className="text-2xl font-bold text-light">
              {cliente.nombre}
            </h2>
            <p className="text-gray-400 text-sm">{cliente.telefono}</p>
          </div>

          {/* Círculos */}
          <div className="mb-6">
            <div className="text-xs text-gray-500 text-center mb-3">PROGRESO</div>
            <div className="flex justify-center gap-2 mb-2">
              {circulos.map((lleno, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    lleno ? 'bg-secondary border-secondary' : 'bg-transparent border-secondary/40'
                  }`}
                />
              ))}
            </div>
            <div className="text-center text-sm text-gray-400">
              {cliente.puntos} / 10 visitas
            </div>
          </div>

          {/* Botón Añadir Visita */}
          {cliente.puntos < 10 && (
            <button
              onClick={handleAddVisit}
              disabled={disabled}
              className="w-full bg-secondary hover:bg-secondary/80 disabled:bg-gray-700 disabled:text-gray-500 text-light font-bold py-4 px-6 rounded-lg transition mb-4"
            >
              {disabled ? 'Procesando...' : 'Añadir Visita (+1)'}
            </button>
          )}

          {/* Cupones Activos */}
          {cuponesCliente.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="text-xs text-gray-500 text-center">CUPONES ACTIVOS</div>
              {cuponesCliente.map((cc) => {
                const diasRestantes = cc.fecha_expiracion 
                  ? Math.ceil((new Date(cc.fecha_expiracion).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <div key={cc.id} className="bg-secondary/80 border border-secondary rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-light">{cc.cupones.nombre}</p>
                        <p className="text-xs text-gray-400">{cc.cupones.descripcion}</p>
                      </div>
                      {diasRestantes !== null && (
                        <span className="text-xs text-gray-500">
                          {diasRestantes} días
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCanjearCupon(cc.id, cc.cupon_id, cc.cupones.tipo)}
                      disabled={disabled}
                      className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-light font-bold py-2 px-4 rounded transition text-sm"
                    >
                      Canjear Cupón
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Botón Volver */}
        <button
          onClick={() => navigate('/admin')}
          className="w-full bg-secondary hover:bg-secondary/80 text-light font-bold py-3 px-6 rounded-lg transition border border-secondary/60"
        >
          ← Volver al Panel
        </button>
      </div>
    </div>
  )
}