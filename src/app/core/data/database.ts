export interface InsumoRecord {
  id: string;
  nombre: string;
  categoria: string;
  tipoMedida: 'peso' | 'volumen' | 'cantidad';
  unidadBase: string;
  presentacionCantidad: number;
  presentacionUnidad: string;
  costoPresentacionUsd: string;
  costoUnidadBaseUsd: string;
  monedaRegistro: 'USD' | 'VES';
  proveedor: string;
  fechaActualizacionCosto: string;
  stockActual: number;
  stockMinimo: number;
}

export interface HistoricoPrecioInsumoRecord {
  id?: number;
  insumoId: string;
  costoUnidadBaseUsd: string;
  fecha: string;
}

export interface PresupuestoRecord {
  id: string;
  clienteNombre: string;
  contacto: string;
  fecha: string;
  items: string; // JSON array
  config: string; // JSON config
  totalUsd: string;
}

export interface CompraRecord {
  id: string;
  proveedor: string;
  fecha: string;
  items: string; // JSON array
  tasaUsd: number;
  totalUsd: string;
  totalBes: string;
  metodoPago: string;
}

export interface ProductoRecord {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  rendimientoCantidad: number;
  rendimientoUnidad: string;
  margenUtilidadPct: string;
  costoTotalUsd: string;
  precioVentaUsd: string;
  notas: string;
}

export interface ItemRecetaRecord {
  id: string;
  productoFinalId: string;
  insumoId: string;
  cantidad: string;
  unidad: string;
  costoLineaUsd: string;
}

export interface TasaCambioRecord {
  id: string;
  tipo: 'BCV_USD' | 'BINANCE_USDT' | 'BCV_EUR';
  valor: string;
  fecha: string;
  esActiva: boolean;
}

export interface TasaHistorialRecord {
  id?: number;
  fecha: string;
  bcv: number;
  binance: number;
  euro: number;
  source: string;
  manual: boolean | number; // SQLite returns 0/1
}
