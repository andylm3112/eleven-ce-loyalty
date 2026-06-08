import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import confetti from 'canvas-confetti'
import type { Admin, Cliente, CuponCliente } from '../types'

type ClienteConNegocio = Cliente & { negocio_id: string }

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
    verificarYCargar()
  }, [clienteId])

  async function verificarYCargar() {
    setLoading(true)
    setError(null)

    if (!clienteId) {
      setError('ID de cliente no válido en la URL.')
      setLoading(false)
      return
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      setError(`Error al verificar sesión: ${sessionError.message}`)
      setLoading(false)
      return
    }

    if (!session) {
      sessionStorage.setItem('redirect_after_login', `/scan/${clienteId}`)
      navigate('/login')
      return
    }

    if (!session.user.email) {
      setError('Tu sesión no tiene email asociado. Vuelve a iniciar sesión.')
      setLoading(false)
      return
    }

    const { data: adminData, error: adminError } = await supabase
      .from('administradores')
      .select('*')
      .eq('email', session.user.email)
      .maybeSingle()

    if (adminError) {
      console.error('Error buscando admin:', adminError)
      setError(
        `No se pudo verificar permisos de administrador (${adminError.code ?? 'error'}).`
      )
      setLoading(false)
      return
    }

    if (!adminData) {
      setLoading(false)
      navigate('/')
      return
    }

    setAdmin(adminData as Admin)

    const { data: clienteData, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', clienteId)
      .maybeSingle()

    if (clienteError) {
      setError(`Error al buscar cliente: ${clienteError.message}`)
      setLoading(false)
      return
    }

    if (!clienteData) {
      setError('Cliente no encontrado. Verifica que el QR sea válido.')
      setLoading(false)
      return
    }

    await verificarExpiracionPuntos(clienteData as ClienteConNegocio)
    await cargarCuponesCliente(clienteData.id)

    setLoading(false)
  }

  async function verificarExpiracionPuntos(clienteData: ClienteConNegocio) {
    // Obtener configuración del negocio
    const { data: negocio } = await supabase
      .from('negocios')
      .select('dias_expiracion')
      .eq('id', clienteData.negocio_id)
      .single()

    if (!negocio || !negocio.dias_expiracion || !clienteData.ultima_visita) {
      setCliente(clienteData)
      return
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

      setMensaje('⚠️ Los puntos de este cliente expiraron por inactividad')
      setCliente(clienteActualizado || { ...clienteData, puntos: 0 })
    } else {
      setCliente(clienteData)
    }
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

      // Insertar en historial
      await supabase.from('historial_visitas').insert({
        cliente_id: cliente.id,
        admin_id: admin.id,
        puntos_sumados: 1
      })

      // Contar total de visitas
      const { count } = await supabase
        .from('historial_visitas')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', cliente.id)

      const totalVisitas = (count || 0) + 1 // +1 por la que acabamos de añadir

      // Verificar si se activa un cupón
      await verificarCupon(totalVisitas, clienteActualizado)

      setCliente(clienteActualizado)
      setMensaje('✅ Visita añadida correctamente')

      if (nuevosPuntos === 10) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#000000']
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

  async function verificarCupon(totalVisitas: number, clienteData: ClienteConNegocio) {
    // Buscar cupón para este hito de visitas
    const { data: cupones } = await supabase
      .from('cupones')
      .select('*')
      .eq('negocio_id', clienteData.negocio_id)
      .eq('visita_requerida', totalVisitas)
      .eq('activo', true)

    if (cupones && cupones.length > 0) {
      const cupon = cupones[0]
      
      // Verificar si ya tiene este cupón
      const { data: existente } = await supabase
        .from('cupones_clientes')
        .select('*')
        .eq('cliente_id', clienteData.id)
        .eq('cupon_id', cupon.id)
        .single()

      if (!existente) {
        // Otorgar cupón
        const fechaExpiracion = new Date()
        fechaExpiracion.setDate(fechaExpiracion.getDate() + (cupon.dias_validez || 30))

        await supabase.from('cupones_clientes').insert({
          cliente_id: clienteData.id,
          cupon_id: cupon.id,
          fecha_expiracion: fechaExpiracion.toISOString()
        })

        setMensaje(`🎉 ¡Felicidades! Ganaste: ${cupon.nombre}`)
        
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#000000']
        })

        // Recargar cupones
        await cargarCuponesCliente(clienteData.id)
      }
    }
  }

  async function handleCanjearCupon(cuponClienteId: string, cuponId: string, tipo: string) {
    if (!cliente || !admin) return

    setDisabled(true)
    setMensaje(null)
    setError(null)

    try {
      // Marcar cupón como canjeado
      await supabase
        .from('cupones_clientes')
        .update({ 
          canjeado: true, 
          fecha_canje: new Date().toISOString() 
        })
        .eq('id', cuponClienteId)

      // Insertar en historial
      await supabase.from('historial_premios').insert({
        cliente_id: cliente.id,
        admin_id: admin.id,
        cupon_id: cuponId,
        puntos_al_canjear: cliente.puntos
      })

      // Si es el corte gratis (visita 10), resetear puntos
      if (tipo === 'producto_gratis') {
        const { data: clienteActualizado } = await supabase
          .from('clientes')
          .update({ puntos: 0 })
          .eq('id', cliente.id)
          .select()
          .single()

        setCliente(clienteActualizado || { ...cliente, puntos: 0 })
      }

      setMensaje('🎁 ¡Cupón canjeado exitosamente!')
      
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#000000']
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#D4AF37] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[#D4AF37]">Cargando cliente...</p>
        </div>
      </div>
    )
  }

  if (error || !cliente) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-red-900/20 border-2 border-red-500 rounded-lg p-6 mb-6">
            <p className="text-red-400 text-center">
              {error || 'No se pudo cargar la información del cliente.'}
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/admin')}
              className="w-full bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold py-3 px-6 rounded-lg transition"
            >
              Volver al Panel
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-lg transition border border-gray-700"
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
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4AF37] mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>
            ELEVEN CE STUDIOS
          </h1>
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
        <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-2xl p-8 shadow-2xl mb-6">
          {/* Nombre */}
          <div className="text-center mb-6">
            <div className="text-xs text-gray-500 mb-1">CLIENTE</div>
            <h2 className="text-2xl font-bold text-[#D4AF37]" style={{ fontFamily: 'Oswald, sans-serif' }}>
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
                    lleno ? 'bg-[#D4AF37] border-[#D4AF37]' : 'bg-transparent border-gray-600'
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
              className="w-full bg-[#D4AF37] hover:bg-[#B8941F] disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-4 px-6 rounded-lg transition mb-4"
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
                  <div key={cc.id} className="bg-zinc-800 border border-[#D4AF37] rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-[#D4AF37]">{cc.cupones.nombre}</p>
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
                      className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white font-bold py-2 px-4 rounded transition text-sm"
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
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-lg transition border border-gray-700"
        >
          ← Volver al Panel
        </button>
      </div>
    </div>
  )
}