import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProductoView } from './producto.service';
import Decimal from 'decimal.js';

@Injectable({ providedIn: 'root' })
export class ExportService {

  async exportProductPdf(product: ProductoView, options: {
    includeRecipe: boolean,
    pricesToInclude: ('detalle' | 'mayor' | 'super_mayor')[]
  }): Promise<void> {
    const doc = new jsPDF();

    // -- Header --
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235); // Accent primary
    doc.text('SEC', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Text muted
    doc.text('Sistema de Estructura de Costos', 14, 26);

    doc.setFontSize(16);
    doc.setTextColor(17, 24, 39); // Text primary
    doc.text('Ficha Técnica de Producto', 14, 40);

    // -- Product Info --
    doc.setFontSize(12);
    doc.text(`Producto: ${product.nombre}`, 14, 50);
    doc.setFontSize(10);
    doc.text(`Categoría: ${product.categoria}`, 14, 56);
    doc.text(`Rendimiento: ${product.rendimiento}`, 14, 62);
    doc.text(`Costo de Producción: $${product.costoTotalUsd.toFixed(2)}`, 14, 68);

    if (product.descripcion) {
      doc.text(`Descripción: ${product.descripcion}`, 14, 74);
    }

    let currentY = product.descripcion ? 84 : 78;

    // -- Prices --
    if (options.pricesToInclude.length > 0) {
      const priceBody = product.precios
        .filter(p => options.pricesToInclude.includes(p.nivel))
        .map(p => [
          p.label,
          `$${new Decimal(p.precioUsd).toFixed(2)}`,
          `${p.margenPct}%`
        ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Nivel de Precio', 'Precio de Venta (USD)', 'Margen']],
        body: priceBody,
        theme: 'grid',
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontSize: 10 },
        styles: { fontSize: 10, textColor: [17, 24, 39] }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // -- Recipe --
    if (options.includeRecipe && product.receta.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text('Estructura de Costos (Receta)', 14, currentY);

      const recipeBody = product.receta.map(item => [
        item.insumoNombre,
        `${item.cantidad.toString()} ${item.unidad}`,
        `$${item.costoLineaUsd.toFixed(2)}`
      ]);

      recipeBody.push([
        { content: 'Costo Total', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `$${product.costoTotalUsd.toFixed(2)}`, styles: { fontStyle: 'bold' } }
      ] as any);

      autoTable(doc, {
        startY: currentY + 6,
        head: [['Insumo', 'Cantidad', 'Costo Línea']],
        body: recipeBody,
        theme: 'grid',
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontSize: 10 },
        styles: { fontSize: 10, textColor: [17, 24, 39] }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // -- Notes --
    if (product.notas) {
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text('Notas adicionales:', 14, currentY);
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      
      const splitNotes = doc.splitTextToSize(product.notas, 180);
      doc.text(splitNotes, 14, currentY + 6);
    }

    // -- Footer --
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Generado por SEC el ${new Date().toLocaleDateString()}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`Ficha_${product.nombre.replace(/\s+/g, '_')}.pdf`);
  }

  /**
   * Exporta un array de arrays a un archivo CSV
   */
  exportToCsv(filename: string, rows: string[][]): void {
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exporta un array de arrays a un archivo PDF
   */
  exportToPdf(filename: string, title: string, headers: string[], rows: string[][]): void {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text('SEC - ' + title, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado el ${new Date().toLocaleDateString()}`, 14, 26);

    autoTable(doc, {
      startY: 35,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 8, textColor: [17, 24, 39] }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.width - 30,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`${filename}.pdf`);
  }
}
