import { useState } from 'react'
import { supabase } from '../lib/supabase'
import TarjetaCliente from './TarjetaCliente'
import type { Cliente } from '../types'

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

export default function ClienteHome() {
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [referidoPor, setReferidoPor] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [mostrarFormularioRegistro, setMostrarFormularioRegistro] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMostrarFormularioRegistro(false)

    try {
      const { data: esAdmin, error: errorAdmin } = await supabase
        .from('administradores')
        .select('*')
        .eq('telefono', telefono)
        .single()

      if (errorAdmin && errorAdmin.code !== 'PGRST116') {
        throw errorAdmin
      }

      if (esAdmin) {
        setError('Los administradores no pueden ser clientes')
        setLoading(false)
        return
      }

      const { data: clienteExistente, error: errorBusqueda } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', telefono)
        .single()

      if (errorBusqueda && errorBusqueda.code !== 'PGRST116') {
        throw errorBusqueda
      }

      if (clienteExistente) {
        setCliente(clienteExistente as Cliente)
      } else {
        setMostrarFormularioRegistro(true)
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al buscar cliente'))
    } finally {
      setLoading(false)
    }
  }

  const registrarCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: negocio, error: errorNegocio } = await supabase
        .from('negocios')
        .select('id')
        .eq('nombre', 'ELEVEN CE STUDIOS')
        .single()

      if (errorNegocio) throw errorNegocio
      if (!negocio) {
        throw new Error('Negocio no encontrado')
      }

      const { data: nuevoCliente, error: errorRegistro } = await supabase
        .from('clientes')
        .insert({
          negocio_id: negocio.id,
          nombre: nombre.trim(),
          telefono: telefono,
          puntos: 0,
          referido_por: referidoPor.trim() || null,
        })
        .select()
        .single()

      if (errorRegistro) throw errorRegistro

      setCliente(nuevoCliente as Cliente)
      setMostrarFormularioRegistro(false)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Error al registrar cliente'))
    } finally {
      setLoading(false)
    }
  }

  const handleVolverBusqueda = () => {
    setCliente(null)
    setMostrarFormularioRegistro(false)
    setTelefono('')
    setNombre('')
    setReferidoPor('')
    setError(null)
  }

  const handleVolverDesdeRegistro = () => {
    setMostrarFormularioRegistro(false)
    setNombre('')
    setReferidoPor('')
    setError(null)
  }

  if (cliente) {
    return <TarjetaCliente cliente={cliente} onVolver={handleVolverBusqueda} />
  }

  if (mostrarFormularioRegistro) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#D4AF37] mb-2">ELEVEN CE STUDIOS</h1>
            <p className="text-gray-400">Completa tu registro</p>
            <p className="text-sm text-zinc-500 mt-2">Teléfono: {telefono}</p>
          </div>

          <form onSubmit={registrarCliente} className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-8">
            <div className="mb-6">
              <label htmlFor="nombre" className="block text-sm font-medium mb-2">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none text-white"
                placeholder="Tu nombre"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="referidoPor" className="block text-sm font-medium mb-2">
                Referido por (opcional)
              </label>
              <input
                id="referidoPor"
                type="text"
                value={referidoPor}
                onChange={(e) => setReferidoPor(e.target.value)}
                className="w-full px-4 py-3 bg-black border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none text-white"
                placeholder="Teléfono o nombre"
              />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {loading ? 'Registrando...' : 'Registrarme'}
            </button>

            <button
              type="button"
              onClick={handleVolverDesdeRegistro}
              disabled={loading}
              className="w-full py-2 text-[#D4AF37] hover:underline text-sm disabled:opacity-50"
            >
              ← Volver a buscar con otro teléfono
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">ELEVEN CE STUDIOS</h1>
          <p className="text-gray-400">Ingresa tu teléfono para ver tu tarjeta de lealtad</p>
        </div>

        <form onSubmit={buscarCliente} className="bg-zinc-900 border border-[#D4AF37] rounded-lg p-8">
          <div className="mb-6">
            <label htmlFor="telefono" className="block text-sm font-medium mb-2">
              Teléfono
            </label>
            <input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-zinc-700 rounded focus:border-[#D4AF37] focus:outline-none text-white"
              placeholder="Ej: 5512345678"
              required
            />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#D4AF37] hover:bg-[#B8941F] text-black font-bold py-3 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Buscando...' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}
