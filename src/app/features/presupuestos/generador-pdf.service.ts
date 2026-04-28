import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProductoFinal, Combo, TasaCambio } from '../../core/models/domain.models';

export interface PresupuestoConfig {
  incluirReceta: boolean;
  mostrarPrecioDetal: boolean;
  mostrarPrecioMayor: boolean;
  mostrarPrecioGranMayor: boolean;
  monedaReporte: 'USD' | 'VES';
}

@Injectable({
  providedIn: 'root'
})
export class GeneradorPdfService {

  public generarPresupuestoProductos(
    productos: ProductoFinal[], 
    config: PresupuestoConfig, 
    tasa: number,
    empresaNombre: string = 'Mi Empresa SEC'
  ): void {
    const doc = new jsPDF();
    
    this.addHeader(doc, empresaNombre, 'Presupuesto de Productos');

    let yPos = 40;

    productos.forEach((prod, index) => {
      // Si nos quedamos sin espacio en la página, añadimos una nueva
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Nombre del Producto
      doc.setFontSize(14);
      doc.setTextColor(33, 37, 41);
      doc.text(`${index + 1}. ${prod.nombre}`, 14, yPos);
      yPos += 8;

      // Rendimiento y Notas
      doc.setFontSize(10);
      doc.setTextColor(108, 117, 125);
      doc.text(`Rendimiento: ${prod.rendimiento.cantidad} ${prod.rendimiento.unidad}`, 14, yPos);
      if (prod.notas) {
        yPos += 5;
        doc.text(`Notas: ${prod.notas}`, 14, yPos);
      }
      yPos += 8;

      // Tabla de Precios
      const headers = ['Nivel de Precio', `Monto (${config.monedaReporte})`];
      const data = [];

      const multiplier = config.monedaReporte === 'VES' ? tasa : 1;
      const currencySymbol = config.monedaReporte === 'VES' ? 'Bs' : '$';

      if (config.mostrarPrecioDetal) {
        data.push(['Precio al Detal', `${currencySymbol} ${(Number(prod.precioVentaDetalUsd || 0) * multiplier).toFixed(2)}`]);
      }
      if (config.mostrarPrecioMayor && prod.precioVentaMayorUsd) {
        data.push(['Precio al Mayor', `${currencySymbol} ${(Number(prod.precioVentaMayorUsd) * multiplier).toFixed(2)}`]);
      }
      if (config.mostrarPrecioGranMayor && prod.precioVentaGranMayorUsd) {
        data.push(['Precio al Gran Mayor', `${currencySymbol} ${(Number(prod.precioVentaGranMayorUsd) * multiplier).toFixed(2)}`]);
      }

      if (data.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [headers],
          body: data,
          theme: 'grid',
          headStyles: { fillColor: [37, 99, 235] },
          margin: { left: 14 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Tabla de Receta (Insumos) si está configurado
      if (config.incluirReceta && prod.receta && prod.receta.length > 0) {
        const recetaHeaders = ['Insumo', 'Cantidad', 'Unidad'];
        const recetaData = prod.receta.map((item: any) => [
          item.insumoNombre || 'Desconocido', 
          item.cantidad.toString(), 
          item.unidad
        ]);

        doc.setFontSize(11);
        doc.setTextColor(33, 37, 41);
        doc.text('Receta (Insumos requeridos):', 14, yPos);
        yPos += 5;

        autoTable(doc, {
          startY: yPos,
          head: [recetaHeaders],
          body: recetaData,
          theme: 'plain',
          headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105] },
          margin: { left: 14 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 15;
      } else {
        yPos += 5;
      }
    });

    this.addFooter(doc, config.monedaReporte, tasa);
    doc.save(`Presupuesto_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  private addHeader(doc: jsPDF, empresaNombre: string, titulo: string): void {
    // Aquí se podría añadir una imagen/logo (doc.addImage) si el usuario lo sube
    
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Color primario
    doc.text(empresaNombre, 14, 20);

    doc.setFontSize(16);
    doc.setTextColor(33, 37, 41);
    doc.text(titulo, 14, 30);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);
  }

  private addFooter(doc: jsPDF, moneda: string, tasa: number): void {
    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      
      const fecha = new Date().toLocaleDateString();
      let footerText = `Generado el ${fecha} | Página ${i} de ${pageCount}`;
      
      if (moneda === 'VES') {
        footerText += ` | Tasa de Cambio: ${tasa.toFixed(2)} Bs/$`;
      }
      
      doc.text(footerText, 14, doc.internal.pageSize.height - 10);
    }
  }
}
