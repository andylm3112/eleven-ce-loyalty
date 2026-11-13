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

function normalizarTelefono(valor: string) {
  return valor.replace(/\D/g, '')
}

function esTelefonoValido(valor: string) {
  const digitos = normalizarTelefono(valor)
  return digitos.length >= 9 && digitos.length <= 15
}

function Cargando({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="h-4 w-4 rounded-full border-2 border-light/40 border-t-light animate-spin" aria-hidden="true" />
      {texto}…
    </span>
  )
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

    const telefonoNormalizado = normalizarTelefono(telefono)

    if (!esTelefonoValido(telefonoNormalizado)) {
      setError('El teléfono debe tener entre 9 y 15 dígitos.')
      setLoading(false)
      return
    }

    setTelefono(telefonoNormalizado)

    try {
      const { data: administradores, error: errorAdmin } = await supabase
        .from('administradores')
        .select('*')
        .eq('telefono', telefonoNormalizado)
        .limit(1)

      if (errorAdmin) throw errorAdmin
      const esAdmin = administradores?.[0]

      if (esAdmin) {
        setError('Los administradores no pueden ser clientes')
        setLoading(false)
        return
      }

      const { data: clientes, error: errorBusqueda } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefono', telefonoNormalizado)
        .limit(1)

      if (errorBusqueda) {
        throw errorBusqueda
      }

      const clienteExistente = clientes?.[0]

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
      const { data: negocios, error: errorNegocio } = await supabase
        .from('negocios')
        .select('id')
        .eq('nombre', 'ELEVEN CE STUDIOS')
        .limit(1)

      if (errorNegocio) throw errorNegocio
      const negocio = negocios?.[0]
      
      if (!negocio) {
        throw new Error('Negocio no encontrado')
      }

      const { data: nuevosClientes, error: errorRegistro } = await supabase
        .from('clientes')
        .insert({
          negocio_id: negocio.id,
          nombre: nombre.trim(),
          telefono: normalizarTelefono(telefono),
          puntos: 0,
          referido_por: referidoPor.trim() || null,
        })
        .select()

      if (errorRegistro) throw errorRegistro

      const nuevoCliente = nuevosClientes?.[0]
      if (!nuevoCliente) {
        throw new Error('Error al registrar cliente')
      }

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
      <div className="min-h-screen text-light flex items-center justify-center p-6">
        <div key="registro" className="w-full max-w-md animate-entrar-arriba">
          <div className="text-center mb-8">
            <img src="/no_bg_image.png" alt="ELEVEN CE STUDIOS" className="h-20 mx-auto mb-4 animate-flotar" />
            <p className="text-gray-400">Completa tu registro</p>
            <p className="text-sm text-zinc-500 mt-2">Teléfono: {telefono}</p>
          </div>

          <form onSubmit={registrarCliente} className="tarjeta-vidrio p-8 animate-entrar-arriba" style={{ animationDelay: '80ms' }}>
            <div className="mb-6">
              <label htmlFor="nombre" className="block text-sm font-medium mb-2">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="campo"
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
                className="campo"
                placeholder="Teléfono o nombre"
              />
            </div>

            {error && (
              <div key={error} role="alert" className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-200 text-sm animate-sacudir">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="boton-principal w-full mb-4"
            >
              {loading ? <Cargando texto="Registrando" /> : 'Registrarme'}
            </button>

            <button
              type="button"
              onClick={handleVolverDesdeRegistro}
              disabled={loading}
              className="w-full py-2 text-gray-300 text-sm transition-colors hover:text-light disabled:opacity-50"
            >
              ← Volver a buscar con otro teléfono
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-light flex items-center justify-center p-6">
      <div key="buscar" className="w-full max-w-md animate-entrar-arriba">
        <div className="text-center mb-8">
          <img src="/no_bg_image.png" alt="ELEVEN CE STUDIOS" className="h-20 mx-auto mb-4 animate-flotar" />
          <p className="text-gray-400">Ingresa tu teléfono para ver tu tarjeta de lealtad</p>
        </div>

        <form onSubmit={buscarCliente} className="tarjeta-vidrio p-8 animate-entrar-arriba" style={{ animationDelay: '80ms' }}>
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
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
              className="campo"
              placeholder="Ej: 6621234567"
              minLength={9}
              maxLength={15}
              required
            />
            <p className="text-xs text-zinc-500 mt-2">9 a 15 dígitos</p>
          </div>

          {error && (
            <div key={error} role="alert" className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-200 text-sm animate-sacudir">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="boton-principal w-full"
          >
            {loading ? <Cargando texto="Buscando" /> : 'Continuar'}
          </button>
        </form>

        <a
          href="/agendar"
          className="boton-secundario block w-full mt-4 text-center animate-entrar-arriba"
          style={{ animationDelay: '160ms' }}
        >
          Agendar una cita
        </a>
      </div>
    </div>
  )
}