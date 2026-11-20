// Insignia "Hecho por Tavra" para el pie de las apps de clientes.
// Autocontenida (estilos en línea, sin dependencias): copiar este archivo a src/components/ del proyecto.
// Uso: <HechoPorTavra tono="claro" href="https://tavra.mx" />
import type { CSSProperties } from 'react';

type Props = {
  /** Fondo sobre el que va: 'claro' (texto tinta, ícono azul) u 'oscuro' (texto blanco, ícono lima) */
  tono?: 'claro' | 'oscuro';
  /** Enlace al sitio de Tavra. Sin enlace se muestra como texto. */
  href?: string;
  style?: CSSProperties;
};

const COLORES = {
  claro: { texto: '#0F0F14', icono: '#2D5BFF' },
  oscuro: { texto: '#FFFFFF', icono: '#B6F09C' }, // el lima solo va sobre oscuro (manual de marca)
};

export default function HechoPorTavra({ tono = 'claro', href, style }: Props) {
  const c = COLORES[tono];
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    lineHeight: 1,
    color: c.texto,
    opacity: 0.55, // discreta: no compite con la marca del cliente
    textDecoration: 'none',
    transition: 'opacity .2s',
    ...style,
  };

  const contenido = (
    <>
      {/* Ícono V-flecha (mismos trazos que el logo final) */}
      <svg aria-hidden="true" width="11" height="13" viewBox="-6 -18 106 124">
        <g fill={c.icono}>
          <path d="M0 0H23L46 68L64.3 14H87.2L58 100H34Z" />
          <path d="M51.6 16.9L85.3 -13.9L93.2 31.1Z" />
        </g>
      </svg>
      <span>
        Hecho por <strong style={{ fontWeight: 700, letterSpacing: '0.04em' }}>Tavra</strong>
      </span>
    </>
  );

  if (!href) return <span style={base}>{contenido}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={base}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.55')}
      onFocus={(e) => (e.currentTarget.style.opacity = '1')}
      onBlur={(e) => (e.currentTarget.style.opacity = '0.55')}
    >
      {contenido}
    </a>
  );
}
