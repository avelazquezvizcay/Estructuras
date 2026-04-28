import { Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { db } from '../data/database';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private toast = inject(ToastService);

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
      
      // Create downloadable file first
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = `sec-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Open mailto with instructions
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
      db.insumos.toArray(),
      db.productos.toArray(),
      db.itemsReceta.toArray(),
      db.tasasCambio.toArray(),
      db.tasaHistorial.toArray()
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
    await db.transaction('rw', [db.insumos, db.productos, db.itemsReceta, db.tasasCambio, db.tasaHistorial], async () => {
      if (data.insumos?.length) { await db.insumos.clear(); await db.insumos.bulkAdd(data.insumos); }
      if (data.productos?.length) { await db.productos.clear(); await db.productos.bulkAdd(data.productos); }
      if (data.recetas?.length) { await db.itemsReceta.clear(); await db.itemsReceta.bulkAdd(data.recetas); }
      if (data.tasas?.length) { await db.tasasCambio.clear(); await db.tasasCambio.bulkAdd(data.tasas); }
      if (data.historial?.length) { await db.tasaHistorial.clear(); await db.tasaHistorial.bulkAdd(data.historial); }
    });
  }

  private async getRecordCount(): Promise<number> {
    const counts = await Promise.all([
      db.insumos.count(),
      db.productos.count(),
      db.itemsReceta.count(),
      db.tasaHistorial.count()
    ]);
    return counts.reduce((a, b) => a + b, 0);
  }
}
