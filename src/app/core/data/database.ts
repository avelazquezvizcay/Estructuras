import Dexie, { type Table } from 'dexie';

export interface InsumoRecord {
  id?: string;
  nombre: string;
  categoria: string;
  tipoMedida: 'peso' | 'volumen' | 'cantidad';
  unidadBase: string;
  presentacionCantidad: number;
  presentacionUnidad: string;
  costoPresentacionUsd: string; // Decimal as string
  costoUnidadBaseUsd: string;
  monedaRegistro: 'USD' | 'VES'; // En qué moneda se registró el costo
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
  id?: string;
  clienteNombre: string;
  contacto: string;
  fecha: string;
  items: string; // JSON array
  config: string; // JSON config
  totalUsd: string;
}

export interface CompraRecord {
  id?: string;
  proveedor: string;
  fecha: string;
  items: string; // JSON array [{insumoId, cantidad, costoUnitarioUsd, subtotalUsd}]
  tasaUsd: number;
  totalUsd: string;
  totalBes: string;
  metodoPago: string;
}

export interface ProductoRecord {
  id?: string;
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
  id?: string;
  productoFinalId: string;
  insumoId: string;
  cantidad: string;
  unidad: string;
  costoLineaUsd: string;
}

export interface TasaCambioRecord {
  id?: string;
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
  manual: boolean;
}

export class SecDatabase extends Dexie {
  insumos!: Table<InsumoRecord, string>;
  productos!: Table<ProductoRecord, string>;
  itemsReceta!: Table<ItemRecetaRecord, string>;
  tasasCambio!: Table<TasaCambioRecord, string>;
  tasaHistorial!: Table<TasaHistorialRecord, number>;
  historicoPrecios!: Table<HistoricoPrecioInsumoRecord, number>;
  presupuestos!: Table<PresupuestoRecord, string>;
  compras!: Table<CompraRecord, string>;

  constructor() {
    super('SecDatabase');

    this.version(1).stores({
      insumos: 'id, nombre, categoria, tipoMedida',
      productos: 'id, nombre, categoria',
      itemsReceta: 'id, productoFinalId, insumoId',
      tasasCambio: 'id, tipo, esActiva, fecha'
    });

    this.version(5).stores({
      insumos: '++id, nombre, categoria, proveedor',
      productos: '++id, nombre, categoria',
      itemsReceta: '++id, productoFinalId, insumoId',
      historicoPrecios: '++id, insumoId, fecha',
      presupuestos: '++id, clienteNombre, fecha',
      tasasCambio: '++id, tipo, fecha',
      tasaHistorial: '++id, fecha',
      compras: '++id, proveedor, fecha, totalUsd'
    });
  }
}

export const db = new SecDatabase();
