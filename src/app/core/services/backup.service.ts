import { Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { SqliteDatabaseService } from './sqlite-database.service';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private toast = inject(ToastService);
  private sqlite = inject(SqliteDatabaseService);

  // ─── Export to JSON file ────────────────────────────────────
  async exportToJson(): Promise<void> {
    try {
      const data = await this.gatherAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sec-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast.success('Respaldo exportado correctamente');
    } catch (e) {
      console.error('Export error:', e);
      this.toast.error('Error al exportar datos');
    }
  }

  // ─── Import from JSON file ─────────────────────────────────
  async importFromJson(file: File): Promise<void> {
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      if (!backup?.data || !backup?.version) {
        throw new Error('Formato de backup inválido');
      }
      await this.restoreAllData(backup.data);
      this.toast.success('Datos importados correctamente. Recarga la página.');
    } catch (e: any) {
      console.error('Import error:', e);
      this.toast.error(e.message || 'Error al importar datos');
    }
  }

  // ─── Email backup via Gmail (mailto) ────────────────────────
  async sendBackupByEmail(email: string): Promise<void> {
    try {
      const data = await this.gatherAllData();
      const json = JSON.stringify(data);
      
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `sec-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const subject = encodeURIComponent(`SEC Backup - ${new Date().toLocaleDateString('es-VE')}`);
      const body = encodeURIComponent(
        `Respaldo del Sistema de Estructura de Costos (SEC)\n\n` +
        `Fecha: ${new Date().toLocaleString('es-VE')}\n` +
        `Registros: ${await this.getRecordCount()} elementos\n\n` +
        `Adjunta el archivo JSON descargado a este correo.\n` +
        `Para restaurar, ve a Configuración > Importar desde JSON.`
      );
      
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
      this.toast.success('Archivo descargado. Adjúntalo al correo que se abrió.');
    } catch (e) {
      console.error('Email backup error:', e);
      this.toast.error('Error al preparar respaldo por correo');
    }
  }

  // ─── Gather all DB data ─────────────────────────────────────
  private async gatherAllData(): Promise<object> {
    const [insumos, productos, recetas, tasas, historial] = await Promise.all([
      this.sqlite.all('SELECT * FROM insumos'),
      this.sqlite.all('SELECT * FROM productos'),
      this.sqlite.all('SELECT * FROM items_receta'),
      this.sqlite.all('SELECT * FROM tasas_cambio'),
      this.sqlite.all('SELECT * FROM tasa_historial')
    ]);

    return {
      version: 2,
      app: 'SEC',
      exportDate: new Date().toISOString(),
      data: { insumos, productos, recetas, tasas, historial }
    };
  }

  // ─── Restore all data ───────────────────────────────────────
  private async restoreAllData(data: any): Promise<void> {
    const statements: { sql: string; params: any[] }[] = [];

    const tables = ['insumos', 'productos', 'items_receta', 'tasas_cambio', 'tasa_historial'];
    for (const table of tables) {
      statements.push({ sql: `DELETE FROM ${table}`, params: [] });
    }

    if (data.insumos?.length) {
      for (const i of data.insumos) {
        statements.push({ 
          sql: 'INSERT INTO insumos (id, nombre, categoria, tipoMedida, unidadBase, presentacionCantidad, presentacionUnidad, costoPresentacionUsd, costoUnidadBaseUsd, monedaRegistro, proveedor, fechaActualizacionCosto, stockActual, stockMinimo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          params: [i.id, i.nombre, i.categoria, i.tipoMedida, i.unidadBase, i.presentacionCantidad, i.presentacionUnidad, i.costoPresentacionUsd, i.costoUnidadBaseUsd, i.monedaRegistro, i.proveedor, i.fechaActualizacionCosto, i.stockActual, i.stockMinimo]
        });
      }
    }
    
    if (data.productos?.length) {
      for (const p of data.productos) {
        statements.push({
          sql: 'INSERT INTO productos (id, nombre, descripcion, categoria, rendimientoCantidad, rendimientoUnidad, margenUtilidadPct, costoTotalUsd, precioVentaUsd, notas) VALUES (?,?,?,?,?,?,?,?,?,?)',
          params: [p.id, p.nombre, p.descripcion, p.categoria, p.rendimientoCantidad, p.rendimientoUnidad, p.margenUtilidadPct, p.costoTotalUsd, p.precioVentaUsd, p.notas]
        });
      }
    }

    if (data.recetas?.length) {
      for (const r of data.recetas) {
        statements.push({
          sql: 'INSERT INTO items_receta (id, productoFinalId, insumoId, cantidad, unidad, costoLineaUsd) VALUES (?,?,?,?,?,?)',
          params: [r.id, r.productoFinalId, r.insumoId, r.cantidad, r.unidad, r.costoLineaUsd]
        });
      }
    }

    await this.sqlite.transaction(statements);
  }

  private async getRecordCount(): Promise<number> {
    const counts = await Promise.all([
      this.sqlite.get('SELECT COUNT(*) as count FROM insumos'),
      this.sqlite.get('SELECT COUNT(*) as count FROM productos'),
      this.sqlite.get('SELECT COUNT(*) as count FROM items_receta'),
      this.sqlite.get('SELECT COUNT(*) as count FROM tasa_historial')
    ]);
    return counts.reduce((a, b) => a + (b.count || 0), 0);
  }
}
