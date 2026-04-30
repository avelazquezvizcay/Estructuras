import { Injectable, signal, computed } from '@angular/core';

export type Lang = 'es' | 'en';

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  es: {
    // ── Navigation ───
    'nav.dashboard': 'Dashboard',
    'nav.insumos': 'Insumos',
    'nav.productos': 'Productos Elaborados',
    'nav.tasas': 'Tasas de Cambio',
    'nav.reportes': 'Reportes',
    'nav.configuracion': 'Configuración',
    'nav.collapse': 'Colapsar',

    // ── Dashboard ───
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Resumen general del sistema de costos',
    'dashboard.export': 'Exportar',
    'dashboard.newProduct': 'Nuevo Producto',
    'dashboard.registeredProducts': 'Prods. Elaborados',
    'dashboard.newThisMonth': 'nuevos este mes',
    'dashboard.activeInputs': 'Insumos Activos',
    'dashboard.categories': 'categorías',
    'dashboard.avgCost': 'Costo Promedio',
    'dashboard.perProduct': 'por producto',
    'dashboard.avgMargin': 'Margen Promedio',
    'dashboard.ofProfit': 'de utilidad',
    'dashboard.activeRates': 'Tasas Activas',
    'dashboard.updatedAgo': 'Actualizado hace 2 horas',
    'dashboard.top5Products': 'Top 5 Elaborados',
    'dashboard.top5ProductsDesc': 'Productos con mayor costo de producción',
    'dashboard.top5Inputs': 'Top 5 Insumos',
    'dashboard.top5InputsDesc': 'Insumos más utilizados en recetas',
    'dashboard.recentActivity': 'Actividad Reciente',
    'dashboard.recentActivityDesc': 'Últimos cambios en el sistema',
    'dashboard.viewAll': 'Ver todos',
    'dashboard.recipes': 'recetas',

    // ── Insumos ───
    'insumos.title': 'Insumos',
    'insumos.subtitle': 'Gestiona las materias primas e ingredientes',
    'insumos.import': 'Importar',
    'insumos.newInput': 'Nuevo Insumo',
    'insumos.search': 'Buscar insumos...',
    'insumos.all': 'Todas',
    'insumos.showing': 'Mostrando',
    'insumos.items': 'insumos',
    'insumos.col.input': 'Insumo',
    'insumos.col.category': 'Categoría',
    'insumos.col.presentation': 'Presentación',
    'insumos.col.costPresentation': 'Costo Presentación',
    'insumos.col.baseCost': 'Costo Base',
    'insumos.col.supplier': 'Proveedor',
    'insumos.col.updated': 'Actualizado',
    'insumos.col.actions': 'Acciones',

    // ── Productos ───
    'productos.title': 'Productos Elaborados',
    'productos.subtitle': 'Gestiona tus productos y sus recetas de costos',
    'productos.newProduct': 'Nuevo Producto',
    'productos.cost': 'Costo',
    'productos.sale': 'Venta',
    'productos.margin': 'Margen',
    'productos.inputs': 'insumos',
    'productos.view': 'Ver',
    'productos.edit': 'Editar',

    // ── Tasas ───
    'tasas.title': 'Tasas de Cambio',
    'tasas.subtitle': 'Gestiona las tasas de cambio para conversión USD ↔ Bs',
    'tasas.register': 'Registrar Tasa',
    'tasas.active': 'Activa',
    'tasas.bsPerUsd': 'Bs por USD',
    'tasas.bsPerUsdt': 'Bs por USDT',
    'tasas.bsPerEur': 'Bs por EUR',
    'tasas.history': 'Histórico de Tasas',
    'tasas.historyDesc': 'Registro de todas las tasas ingresadas',
    'tasas.col.type': 'Tipo',
    'tasas.col.value': 'Valor (Bs)',
    'tasas.col.date': 'Fecha',
    'tasas.col.status': 'Estado',
    'tasas.col.actions': 'Acciones',
    'tasas.historical': 'Histórica',

    // ── Reportes ───
    'reportes.title': 'Reportes',
    'reportes.subtitle': 'Genera y exporta reportes de tu estructura de costos',
    'reportes.preview': 'Vista Previa',
    'reportes.costStructure': 'Estructura de Costos',
    'reportes.costStructureDesc': 'Desglose completo del costo de producción por producto.',
    'reportes.priceList': 'Lista de Precios',
    'reportes.priceListDesc': 'Listado de todos los productos con precios en USD y Bs.',
    'reportes.inputUsage': 'Uso de Insumos',
    'reportes.inputUsageDesc': 'Análisis de qué insumos son más utilizados.',
    'reportes.marginAnalysis': 'Análisis de Márgenes',
    'reportes.marginAnalysisDesc': 'Comparativa de márgenes de utilidad entre productos.',
    'reportes.rateHistory': 'Histórico de Tasas',
    'reportes.rateHistoryDesc': 'Evolución de las tasas de cambio a lo largo del tiempo.',
    'reportes.techSheet': 'Ficha Técnica',
    'reportes.techSheetDesc': 'Documento imprimible con la ficha técnica del producto.',

    // ── Configuración ───
    'config.title': 'Configuración',
    'config.subtitle': 'Ajusta las preferencias del sistema',
    'config.currency': 'Moneda Principal',
    'config.currencyDesc': 'Define la moneda base. Los costos pueden registrarse en USD o Bs.',
    'config.dollarUsd': 'Dólar (USD)',
    'config.bolivar': 'Bolívar (VES)',
    'config.bsNote': 'Los valores en Bs se convertirán a USD usando la tasa preferida.',
    'config.usdNote': 'Los valores se mostrarán en USD con equivalentes en Bs.',
    'config.preferredRate': 'Tasa de Cambio Preferida',
    'config.preferredRateDesc': 'Tasa usada por defecto al convertir entre USD y Bs',
    'config.bcvDesc': 'Tasa oficial del Banco Central de Venezuela',
    'config.binanceDesc': 'Tasa P2P de Binance para USDT',
    'config.euroDesc': 'Tasa oficial del BCV para Euros',
    'config.decimals': 'Decimales de Visualización',
    'config.decimalsDesc': 'Cantidad de decimales al mostrar valores monetarios',
    'config.example': 'Ejemplo',
    'config.backup': 'Backup y Restauración',
    'config.backupDesc': 'Exporta o importa toda la base de datos local',
    'config.exportJson': 'Exportar Datos (JSON)',
    'config.importData': 'Importar Datos',
    'config.backupNote': 'Los datos se guardan localmente en tu dispositivo.',
    'config.appearance': 'Apariencia',
    'config.appearanceDesc': 'Selecciona el tema visual de la aplicación',
    'config.lightMode': 'Claro',
    'config.darkMode': 'Oscuro',
    'config.language': 'Idioma',
    'config.languageDesc': 'Selecciona el idioma de la interfaz',

    // ── Common ───
    'common.edit': 'Editar',
    'common.delete': 'Eliminar',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.close': 'Cerrar',
    'common.loading': 'Cargando...',
    'common.base': 'Base',
    'common.cost': 'Costo',
    'common.updated': 'Actualizada',
    'common.share': 'Compartir',
    'common.profile': 'Perfil de usuario',
  },

  en: {
    // ── Navigation ───
    'nav.dashboard': 'Dashboard',
    'nav.insumos': 'Ingredients',
    'nav.productos': 'Products',
    'nav.tasas': 'Exchange Rates',
    'nav.reportes': 'Reports',
    'nav.configuracion': 'Settings',
    'nav.collapse': 'Collapse',

    // ── Dashboard ───
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Cost structure system overview',
    'dashboard.export': 'Export',
    'dashboard.newProduct': 'New Product',
    'dashboard.registeredProducts': 'Registered Products',
    'dashboard.newThisMonth': 'new this month',
    'dashboard.activeInputs': 'Active Ingredients',
    'dashboard.categories': 'categories',
    'dashboard.avgCost': 'Average Cost',
    'dashboard.perProduct': 'per product',
    'dashboard.avgMargin': 'Average Margin',
    'dashboard.ofProfit': 'profit',
    'dashboard.activeRates': 'Active Rates',
    'dashboard.updatedAgo': 'Updated 2 hours ago',
    'dashboard.top5Products': 'Top 5 Products',
    'dashboard.top5ProductsDesc': 'Products with highest production cost',
    'dashboard.top5Inputs': 'Top 5 Ingredients',
    'dashboard.top5InputsDesc': 'Most used ingredients in recipes',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.recentActivityDesc': 'Latest system changes',
    'dashboard.viewAll': 'View all',
    'dashboard.recipes': 'recipes',

    // ── Insumos ───
    'insumos.title': 'Ingredients',
    'insumos.subtitle': 'Manage raw materials and ingredients',
    'insumos.import': 'Import',
    'insumos.newInput': 'New Ingredient',
    'insumos.search': 'Search ingredients...',
    'insumos.all': 'All',
    'insumos.showing': 'Showing',
    'insumos.items': 'ingredients',
    'insumos.col.input': 'Ingredient',
    'insumos.col.category': 'Category',
    'insumos.col.presentation': 'Package',
    'insumos.col.costPresentation': 'Package Cost',
    'insumos.col.baseCost': 'Base Cost',
    'insumos.col.supplier': 'Supplier',
    'insumos.col.updated': 'Updated',
    'insumos.col.actions': 'Actions',

    // ── Productos ───
    'productos.title': 'Final Products',
    'productos.subtitle': 'Manage your products and cost recipes',
    'productos.newProduct': 'New Product',
    'productos.cost': 'Cost',
    'productos.sale': 'Sale',
    'productos.margin': 'Margin',
    'productos.inputs': 'ingredients',
    'productos.view': 'View',
    'productos.edit': 'Edit',

    // ── Tasas ───
    'tasas.title': 'Exchange Rates',
    'tasas.subtitle': 'Manage exchange rates for USD ↔ Bs conversion',
    'tasas.register': 'Register Rate',
    'tasas.active': 'Active',
    'tasas.bsPerUsd': 'Bs per USD',
    'tasas.bsPerUsdt': 'Bs per USDT',
    'tasas.bsPerEur': 'Bs per EUR',
    'tasas.history': 'Rate History',
    'tasas.historyDesc': 'Record of all submitted rates',
    'tasas.col.type': 'Type',
    'tasas.col.value': 'Value (Bs)',
    'tasas.col.date': 'Date',
    'tasas.col.status': 'Status',
    'tasas.col.actions': 'Actions',
    'tasas.historical': 'Historical',

    // ── Reportes ───
    'reportes.title': 'Reports',
    'reportes.subtitle': 'Generate and export cost structure reports',
    'reportes.preview': 'Preview',
    'reportes.costStructure': 'Cost Structure',
    'reportes.costStructureDesc': 'Full breakdown of production cost per product.',
    'reportes.priceList': 'Price List',
    'reportes.priceListDesc': 'All products with prices in USD and Bs.',
    'reportes.inputUsage': 'Ingredient Usage',
    'reportes.inputUsageDesc': 'Analysis of most used ingredients.',
    'reportes.marginAnalysis': 'Margin Analysis',
    'reportes.marginAnalysisDesc': 'Profit margin comparison between products.',
    'reportes.rateHistory': 'Rate History',
    'reportes.rateHistoryDesc': 'Exchange rate evolution over time.',
    'reportes.techSheet': 'Tech Sheet',
    'reportes.techSheetDesc': 'Printable product technical sheet.',

    // ── Configuración ───
    'config.title': 'Settings',
    'config.subtitle': 'Adjust system preferences',
    'config.currency': 'Primary Currency',
    'config.currencyDesc': 'Default currency. Costs can be entered in USD or Bs.',
    'config.dollarUsd': 'Dollar (USD)',
    'config.bolivar': 'Bolívar (VES)',
    'config.bsNote': 'Bs values will be converted to USD using the preferred rate.',
    'config.usdNote': 'Values will be shown in USD with Bs equivalents.',
    'config.preferredRate': 'Preferred Exchange Rate',
    'config.preferredRateDesc': 'Default rate used for USD ↔ Bs conversion',
    'config.bcvDesc': 'Official Central Bank of Venezuela rate',
    'config.binanceDesc': 'Binance P2P rate for USDT',
    'config.euroDesc': 'Official BCV rate for Euros',
    'config.decimals': 'Display Decimals',
    'config.decimalsDesc': 'Number of decimals for monetary values',
    'config.example': 'Example',
    'config.backup': 'Backup & Restore',
    'config.backupDesc': 'Export or import the entire local database',
    'config.exportJson': 'Export Data (JSON)',
    'config.importData': 'Import Data',
    'config.backupNote': 'Data is saved locally on your device.',
    'config.appearance': 'Appearance',
    'config.appearanceDesc': 'Select the application visual theme',
    'config.lightMode': 'Light',
    'config.darkMode': 'Dark',
    'config.language': 'Language',
    'config.languageDesc': 'Select the interface language',

    // ── Common ───
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.base': 'Base',
    'common.cost': 'Cost',
    'common.updated': 'Updated',
    'common.share': 'Share',
    'common.profile': 'User profile',
  }
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>(this.loadLang());

  readonly lang = this._lang.asReadonly();

  readonly translations = computed(() => TRANSLATIONS[this._lang()]);

  t(key: string): string {
    return TRANSLATIONS[this._lang()][key] || key;
  }

  setLang(lang: Lang): void {
    this._lang.set(lang);
    try { localStorage.setItem('sec_lang', lang); } catch {}
    document.documentElement.lang = lang;
  }

  private loadLang(): Lang {
    try {
      const stored = localStorage.getItem('sec_lang');
      if (stored === 'es' || stored === 'en') return stored;
    } catch {}
    return 'es';
  }
}
