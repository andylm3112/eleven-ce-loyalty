import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import confetti from 'canvas-confetti'
import { supabase } from '../lib/supabase'
import type { Cliente, CuponCliente } from '../types'

interface Props {
  cliente: Cliente
  onVolver: () => void
}

export default function TarjetaCliente({ cliente: clienteInicial, onVolver }: Props) {
  const [cliente, setCliente] = useState(clienteInicial)
  const [cupones, setCupones] = useState<CuponCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [mensajeExpiracion, setMensajeExpiracion] = useState<string | null>(null)

  useEffect(() => {
    verificarYCargarDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [])

  const verificarYCargarDatos = async () => {
    try {
      await verificarExpiracionPuntos()
      await cargarCupones()

      if (cliente.puntos === 10) {
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#D4AF37', '#FFD700', '#000000'],
          })
        }, 500)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const verificarExpiracionPuntos = async () => {
    if (!cliente.ultima_visita || cliente.puntos === 0) {
      return
    }

    const hoy = new Date()
    const ultimaVisita = new Date(cliente.ultima_visita)
    const diasTranscurridos = Math.floor(
      (hoy.getTime() - ultimaVisita.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diasTranscurridos > 30) {
      const { data } = await supabase
        .from('clientes')
        .update({ puntos: 0 })
        .eq('id', cliente.id)
        .select()
        .single()

      if (data) {
        setCliente(data as Cliente)
        setMensajeExpiracion('Tus puntos expiraron por inactividad. ¡Empieza de nuevo!')
      }
    }
  }

  const cargarCupones = async () => {
    const { data } = await supabase
      .from('cupones_clientes')
      .select('*, cupones(*)')
      .eq('cliente_id', cliente.id)
      .eq('canjeado', false)

    if (data) {
      const hoy = new Date()
      const cuponesActivos = data.filter((cupon) => {
        const expiracion = new Date(cupon.fecha_expiracion)
        return expiracion > hoy
      })
      setCupones(cuponesActivos as CuponCliente[])
    }
  }

  const calcularDiasRestantes = (fechaExpiracion: string) => {
    const hoy = new Date()
    const expiracion = new Date(fechaExpiracion)
    const dias = Math.ceil((expiracion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return dias > 0 ? dias : 0
  }

  const puntos = cliente.puntos || 0
  const qrUrl = `${import.meta.env.VITE_APP_DOMAIN}/scan/${cliente.id}`

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-[#D4AF37] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">ELEVEN CE STUDIOS</h1>
          <p className="text-gray-400">Tarjeta de Fidelidad</p>
        </div>

        {/* Tarjeta principal */}
        <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-[#D4AF37] rounded-2xl p-8 shadow-2xl mb-6">
          {/* Nombre y teléfono */}
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">{cliente.nombre}</h2>
            <p className="text-gray-400">Tel: {cliente.telefono}</p>
          </div>

          {/* Mensaje de expiración */}
          {mensajeExpiracion && (
            <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-200 text-sm text-center">
              {mensajeExpiracion}
            </div>
          )}

          {/* Progreso */}
          <div className="mb-8">
            <p className="text-center text-lg mb-4">
              <span className="text-[#D4AF37] font-bold text-2xl">{puntos}</span>
              <span className="text-gray-400"> / 10 visitas</span>
            </p>

            {/* Círculos de puntos */}
            <div className="flex gap-2 flex-wrap justify-center">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                <div
                  key={num}
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all
                    ${
                      num <= puntos
                        ? 'bg-[#D4AF37] border-[#D4AF37] text-black scale-110 shadow-lg shadow-[#D4AF37]/50'
                        : 'bg-transparent border-zinc-700 text-zinc-600'
                    }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          {/* QR Code */}
          <div className="mb-4">
            <div className="bg-white p-6 rounded-xl mx-auto w-fit">
              <QRCodeCanvas value={qrUrl} size={200} level="H" includeMargin={false} />
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">Muestra este código en tu próxima visita</p>
          </div>
        </div>

        {/* Cupones activos */}
        {cupones.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-bold text-[#D4AF37] mb-3">🎁 Cupones Disponibles</h3>
            {cupones.map((cupon) => (
              <div key={cupon.id} className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-4 mb-3">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-lg">{cupon.cupones.nombre}</h4>
                  <span className="text-xs bg-[#D4AF37] text-black px-3 py-1 rounded font-bold">
                    {cupon.cupones.tipo === '2x1' ? '2x1' : 'GRATIS'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-2">{cupon.cupones.descripcion}</p>
                <p className="text-xs text-yellow-400">
                  ⏰ Expira en {calcularDiasRestantes(cupon.fecha_expiracion)} días
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Botón volver */}
        <button
          onClick={onVolver}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition"
        >
          ← Nueva búsqueda
        </button>
      </div>
    </div>
  )
}
