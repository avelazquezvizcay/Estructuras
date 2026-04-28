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

  constructor() {
    super('SecDatabase');

    this.version(1).stores({
      insumos: 'id, nombre, categoria, tipoMedida',
      productos: 'id, nombre, categoria',
      itemsReceta: 'id, productoFinalId, insumoId',
      tasasCambio: 'id, tipo, esActiva, fecha'
    });

    this.version(2).stores({
      insumos: 'id, nombre, categoria, tipoMedida',
      productos: 'id, nombre, categoria',
      itemsReceta: 'id, productoFinalId, insumoId',
      tasasCambio: 'id, tipo, esActiva, fecha',
      tasaHistorial: '++id, fecha, source'
    });
  }
}

export const db = new SecDatabase();
