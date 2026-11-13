import type { AvisoData, TipoAviso } from '../lib/useAviso'

const ESTILOS: Record<TipoAviso, string> = {
  exito: 'border-green-500/60 bg-green-950/85 text-green-100',
  premio: 'border-oro/70 bg-primary/95 text-light shadow-oro',
  info: 'border-secondary bg-primary/95 text-light',
  error: 'border-red-500/60 bg-red-950/85 text-red-100',
}

// Aviso flotante en la parte superior; se cierra solo o al tocarlo
export function Aviso({ aviso, onCerrar }: { aviso: AvisoData | null; onCerrar: () => void }) {
  if (!aviso) return null

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
      <button
        key={aviso.id}
        type="button"
        onClick={onCerrar}
        role="status"
        aria-live="polite"
        className={`w-full rounded-xl border px-4 py-3 text-center font-semibold backdrop-blur-md animate-aviso-entrar ${ESTILOS[aviso.tipo]}`}
      >
        {aviso.texto}
      </button>
    </div>
  )
}
