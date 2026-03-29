export interface Cliente {
  id: string
  nombre: string
  telefono: string
  puntos: number
  ultima_visita: string | null
  referido_por: string | null
}

export interface Cupon {
  id: string
  nombre: string
  descripcion: string
  tipo: string
  visita_requerida: number
  dias_validez: number
}

export interface CuponCliente {
  id: string
  cliente_id: string
  cupon_id: string
  fecha_obtencion: string
  fecha_expiracion: string
  canjeado: boolean
  cupones: Cupon
}

export interface Admin {
  id: string
  email: string
  rol: 'dueño' | 'admin'
}
