import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAdmin } from '../hooks/useAdmin'
import { supabase } from '../lib/supabase'
import confetti from 'canvas-confetti'
import type { Cliente, CuponCliente } from '../types'

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

export default function ScanPage() {
  const { clienteId } = useParams<{ clienteId: string }>()
  const { admin, loading: adminLoading } = useAdmin()
  const navigate = useNavigate()

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [cupones, setCupones] = useState<CuponCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const cargarCupones = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('cupones_clientes')
      .select('*, cupones(*)')
      .eq('cliente_id', id)
      .eq('canjeado', false)

    if (data) {
      const hoy = new Date()
      const cuponesActivos = data.filter((cupon) => {
        const expiracion = new Date(cupon.fecha_expiracion)
        return expiracion > hoy
      })
      setCupones(cuponesActivos as CuponCliente[])
    }
  }, [])

  const verificarExpiracionPuntos = async (clienteData: Cliente): Promise<Cliente> => {
    if (!clienteData.ultima_visita || clienteData.puntos === 0) {
      return clienteData
    }

    const hoy = new Date()
    const ultimaVisita = new Date(clienteData.ultima_visita)
    const diasTranscurridos = Math.floor(
      (hoy.getTime() - ultimaVisita.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diasTranscurridos > 30) {
      const { data } = await supabase
        .from('clientes')
        .update({ puntos: 0 })
        .eq('id', clienteData.id)
        .select()
        .single()

      if (data) {
        setMensaje('⚠️ Los puntos de este cliente expiraron por inactividad')
        return data as Cliente
      }
    }

    return clienteData
  }

  const cargarCliente = useCallback(async () => {
    if (!clienteId) return

    try {
      setLoading(true)
      setError(null)

      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single()

      if (clienteError || !clienteData) {
        setError('Cliente no encontrado')
        return
      }

      const clienteTyped = clienteData as Cliente
      const clienteActualizado = await verificarExpiracionPuntos(clienteTyped)
      setCliente(clienteActualizado)

      await cargarCupones(clienteTyped.id)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al cargar cliente'))
    } finally {
      setLoading(false)
    }
  }, [clienteId, cargarCupones])

  useEffect(() => {
    if (!adminLoading && !admin) {
      sessionStorage.setItem('redirect_after_login', `/scan/${clienteId}`)
      navigate('/login')
    }
  }, [admin, adminLoading, navigate, clienteId])

  useEffect(() => {
    if (admin && clienteId) {
      void cargarCliente()
    } else if (admin && !clienteId) {
      setLoading(false)
      setError('Cliente no encontrado')
    }
  }, [admin, clienteId, cargarCliente])

  const handleAddVisit = async () => {
    if (!cliente || !admin) return

    setDisabled(true)
    setError(null)
    setMensaje(null)

    try {
      // Verificar límite 1 punto por día
      if (cliente.ultima_visita) {
        const hoy = new Date().toDateString()
        const ultima = new Date(cliente.ultima_visita).toDateString()

        if (hoy === ultima) {
          setError('⚠️ Ya se sumó una visita hoy. Límite: 1 punto por día.')
          setTimeout(() => setDisabled(false), 3000)
          return
        }
      }

      const nuevosPuntos = cliente.puntos + 1
      const { data: clienteActualizado } = await supabase
        .from('clientes')
        .update({
          puntos: nuevosPuntos,
          ultima_visita: new Date().toISOString(),
        })
        .eq('id', cliente.id)
        .select()
        .single()

      await supabase.from('historial_visitas').insert({
        cliente_id: cliente.id,
        admin_id: admin.id,
        puntos_sumados: 1,
      })

      const { count } = await supabase
        .from('historial_visitas')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', cliente.id)

      const totalVisitas = count ?? 0

      const { data: cuponActivado } = await supabase
        .from('cupones')
        .select('*')
        .eq('visita_requerida', totalVisitas)
        .eq('activo', true)
        .maybeSingle()

      if (cuponActivado) {
        const expiracion = new Date()
        expiracion.setDate(expiracion.getDate() + cuponActivado.dias_validez)

        await supabase.from('cupones_clientes').insert({
          cliente_id: cliente.id,
          cupon_id: cuponActivado.id,
          fecha_expiracion: expiracion.toISOString(),
        })

        confetti({
          particleCount: 150,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#FFD700', '#000000'],
        })

        setMensaje(`🎉 ¡${cliente.nombre} ganó: ${cuponActivado.nombre}!`)
      } else if (nuevosPuntos === 10) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#FFD700', '#000000'],
        })
        setMensaje(`🎊 ¡${cliente.nombre} completó 10 visitas!`)
      } else {
        setMensaje(`✅ Visita agregada. Puntos: ${nuevosPuntos}/10`)
      }

      if (clienteActualizado) {
        setCliente(clienteActualizado as Cliente)
      }
      await cargarCupones(cliente.id)

      setTimeout(() => setDisabled(false), 3000)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al agregar visita'))
      setTimeout(() => setDisabled(false), 3000)
    }
  }

  const handleRedeemCoupon = async (
    cuponClienteId: string,
    cuponId: string,
    visitaRequerida: number
  ) => {
    if (!cliente || !admin) return

    setDisabled(true)
    setError(null)
    setMensaje(null)

    try {
      await supabase
        .from('cupones_clientes')
        .update({
          canjeado: true,
          fecha_canje: new Date().toISOString(),
        })
        .eq('id', cuponClienteId)

      await supabase.from('historial_premios').insert({
        cliente_id: cliente.id,
        admin_id: admin.id,
        cupon_id: cuponId,
        puntos_al_canjear: cliente.puntos,
      })

      if (visitaRequerida === 10) {
        await supabase.from('clientes').update({ puntos: 0 }).eq('id', cliente.id)

        setMensaje(`🎁 Cupón canjeado. Puntos reseteados a 0.`)
      } else {
        setMensaje(`🎁 Cupón canjeado exitosamente.`)
      }

      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#FFD700', '#000000'],
      })

      setTimeout(() => {
        void cargarCliente()
        setDisabled(false)
      }, 2000)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al canjear cupón'))
      setTimeout(() => setDisabled(false), 3000)
    }
  }

  const calcularDiasRestantes = (fechaExpiracion: string) => {
    const hoy = new Date()
    const expiracion = new Date(fechaExpiracion)
    const dias = Math.ceil((expiracion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return dias > 0 ? dias : 0
  }

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-[#D4AF37] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!admin) {
    return null
  }

  if (error && !cliente) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-400 mb-4">{error}</h1>
          <button
            onClick={() => navigate('/admin')}
            className="px-6 py-3 bg-[#D4AF37] text-black font-bold rounded-lg hover:bg-[#B8941F] transition"
          >
            Volver al Panel
          </button>
        </div>
      </div>
    )
  }

  if (!cliente) {
    return null
  }

  const puntos = cliente.puntos || 0

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">ELEVEN CE STUDIOS</h1>
          <p className="text-gray-400">Panel de Administrador</p>
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-2xl p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">{cliente.nombre}</h2>
            <p className="text-gray-400">Tel: {cliente.telefono}</p>
          </div>

          <div className="mb-6">
            <p className="text-center text-lg mb-4">
              <span className="text-[#D4AF37] font-bold text-3xl">{puntos}</span>
              <span className="text-gray-400 text-xl"> / 10 visitas</span>
            </p>

            <div className="flex gap-2 flex-wrap justify-center mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <div
                  key={num}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm
                    ${
                      num <= puntos
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-lg'
                        : 'bg-transparent border-zinc-700 text-zinc-600'
                    }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          {mensaje && (
            <div className="mb-4 p-4 bg-green-900/20 border border-green-500 rounded text-green-200 text-sm text-center font-bold">
              {mensaje}
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          {puntos < 10 && (
            <button
              onClick={handleAddVisit}
              disabled={disabled}
              className="w-full bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold py-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mb-3 text-lg"
            >
              {disabled ? 'Procesando...' : '➕ Añadir Visita (+1)'}
            </button>
          )}
        </div>

        {cupones.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold text-[#D4AF37] mb-3">🎁 Cupones Disponibles</h3>
            {cupones.map((cupon) => (
              <div key={cupon.id} className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-4 mb-3">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-lg mb-1">{cupon.cupones.nombre}</h4>
                    <p className="text-gray-400 text-sm mb-2">{cupon.cupones.descripcion}</p>
                    <p className="text-xs text-yellow-400">
                      ⏰ Expira en {calcularDiasRestantes(cupon.fecha_expiracion)} días
                    </p>
                  </div>
                  <span className="text-xs bg-[#D4AF37] text-black px-3 py-1 rounded font-bold whitespace-nowrap">
                    {cupon.cupones.tipo === '2x1' ? '2x1' : 'GRATIS'}
                  </span>
                </div>
                <button
                  onClick={() =>
                    handleRedeemCoupon(cupon.id, cupon.cupon_id, cupon.cupones.visita_requerida)
                  }
                  disabled={disabled}
                  className="w-full bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded transition disabled:opacity-50"
                >
                  {disabled ? 'Procesando...' : '✓ Canjear Cupón'}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/admin')}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition"
        >
          ← Volver al Panel
        </button>
      </div>
    </div>
  )
}
