import Decimal from 'decimal.js';

// ── Configure Decimal globally ─────────────────────────────
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ── Measurement types ──────────────────────────────────────
export type TipoMedida = 'peso' | 'volumen' | 'cantidad';
export type UnidadPeso = 'g' | 'kg';
export type UnidadVolumen = 'ml' | 'l';
export type UnidadCantidad = 'unidad' | 'docena';
export type UnidadMedida = UnidadPeso | UnidadVolumen | UnidadCantidad;

// ── Exchange rate types ────────────────────────────────────
export type TipoTasa = 'BCV_USD' | 'BINANCE_USDT' | 'BCV_EUR';

// ── Currency types ─────────────────────────────────────────
export type MonedaPrincipal = 'USD' | 'VES';

// ── Insumo (ingredient / raw material) ─────────────────────
export interface Insumo {
  id: string;
  nombre: string;
  categoria: string;
  tipoMedida: TipoMedida;
  unidadBase: UnidadMedida;
  presentacionCompra: {
    cantidad: number;
    unidad: string;
  };
  costoPresentacionUsd: Decimal;
  costoUnidadBaseUsd: Decimal;
  proveedor: string | null;
  fechaActualizacionCosto: string; // ISO datetime
}

// ── ProductoFinal ──────────────────────────────────────────
export interface ProductoFinal {
  id: string;
  nombre: string;
  descripcion: string;
  rendimiento: {
    cantidad: number;
    unidad: string;
  };
  margenUtilidadPct: Decimal;
  costoTotalUsd: Decimal;
  precioVentaDetalUsd: Decimal; // Precio normal
  precioVentaMayorUsd?: Decimal; // Precio al mayor
  precioVentaGranMayorUsd?: Decimal; // Precio al gran mayor
  notas: string;
  receta: ItemReceta[];
}

// ── Combo (Agrupación de productos) ───────────────────────
export interface ItemCombo {
  productoId: string;
  productoNombre: string;
  cantidad: number;
  precioUnitarioUsd: Decimal;
  subtotalUsd: Decimal;
}

export interface Combo {
  id: string;
  nombre: string;
  descripcion: string;
  items: ItemCombo[];
  costoTotalUsd: Decimal;
  precioVentaUsd: Decimal;
}

// ── ItemReceta (recipe line item) ──────────────────────────
export interface ItemReceta {
  id: string;
  productoFinalId: string;
  insumoId: string;
  insumoNombre?: string;
  cantidad: Decimal;
  unidad: string;
  costoLineaUsd: Decimal;
}

// ── TasaCambio (exchange rate) ─────────────────────────────
export interface TasaCambio {
  id: string;
  tipo: TipoTasa;
  valor: Decimal;
  fecha: string; // ISO datetime
  esActiva: boolean;
}

// ── ConfiguracionApp ───────────────────────────────────────
export interface ConfiguracionApp {
  tasaPreferida: TipoTasa;
  monedaPrincipal: MonedaPrincipal;
  decimalesVisualizacion: number;
}

// ── Navigation item for sidebar ────────────────────────────
export interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
}

// ── Dashboard KPI ──────────────────────────────────────────
export interface DashboardKpi {
  label: string;
  value: string;
  subvalue?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'purple' | 'danger';
}
