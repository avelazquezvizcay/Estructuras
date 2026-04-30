import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class GeminiAiService {
  private readonly API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

  public isLoading = signal(false);

  constructor() {}

  /**
   * Analiza una imagen de factura directamente usando Gemini Vision
   */
  public async analyzeInvoiceImage(base64Image: string, insumosDisponibles: any[], tasaVenta: number): Promise<any> {
    const apiKey = environment.geminiApiKey;
    if (!apiKey) return { items: [] };

    this.isLoading.set(true);
    const mimeType = this.extractMimeType(base64Image) || 'image/jpeg';
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const prompt = `Analiza esta imagen de factura.
    Tasa: 1 USD = ${tasaVenta} Bs.
    
    Insumos del sistema: ${JSON.stringify(insumosDisponibles.slice(0, 50))}

    INSTRUCCIONES:
    1. Si la factura está en Bs, convierte a USD usando la tasa ${tasaVenta}.
    2. Extrae Nombre, Cantidad, Costo Unitario USD.
    3. Responde ÚNICAMENTE con un objeto JSON con este formato (sin texto extra):
       {
         "proveedor": "Nombre del Supermercado o Tienda",
         "fecha": "YYYY-MM-DD",
         "items": [
           {
             "insumoId": "id_si_existe",
             "nombre": "nombre_factura",
             "cantidad": numero,
             "costoUnitarioUsd": "decimal",
             "subtotalUsd": "decimal",
             "categoria": "...",
             "presentacionValor": numero, 
             "presentacionUnidad": "g|kg|ml|l|unidad",
             "sugerenciaId": "id_parecido",
             "sugerenciaNombre": "nombre_parecido"
           }
         ]
       }
       
    NOTA IMPORTANTE: 
    - Las cantidades a veces aparecen en una línea superior al nombre con el formato 'Nx' (ej: '3x Bs 1000'). Detecta ese número '3' como la cantidad.
    - Para la presentación, si el nombre es 'Harina 1kg', el valor es 1 y la unidad es 'kg'. Si es 'Crema 340gr', el valor es 340 y la unidad es 'g'.`;

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: cleanBase64 } }]
          }],
          generationConfig: { temperature: 0 }
        })
      });

      if (!response.ok) throw new Error('Error en Gemini API');
      const result = await response.json();
      const content = result.candidates[0]?.content?.parts[0]?.text || '{}';
      return JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch (error) {
      console.error('Gemini Error:', error);
      return { items: [] };
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Analiza un documento RIF
   */
  public async analyzeRifImage(base64Image: string): Promise<any> {
    const apiKey = environment.geminiApiKey;
    if (!apiKey) return null;

    const mimeType = this.extractMimeType(base64Image) || 'image/jpeg';
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const prompt = `Analiza este documento RIF de Venezuela. 
    Extrae: Nombre/Razón Social, Número de RIF (J-...), y Dirección Fiscal.
    Responde ÚNICAMENTE con un JSON:
    { "nombre": "...", "rif": "...", "direccion": "..." }`;

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: cleanBase64 } }]
          }],
          generationConfig: { temperature: 0 }
        })
      });

      if (!response.ok) return null;
      const result = await response.json();
      const content = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (error) {
      console.error('Gemini RIF Error:', error);
      return null;
    }
  }

  public async generateContentWithImage(prompt: string, base64Data?: string): Promise<string> {
    const apiKey = environment.geminiApiKey;
    if (!apiKey) return '';

    const parts: any[] = [{ text: prompt }];
    if (base64Data) {
      const mimeType = this.extractMimeType(base64Data) || 'image/jpeg';
      const cleanBase64 = base64Data.split(',')[1] || base64Data;
      parts.push({ inline_data: { mime_type: mimeType, data: cleanBase64 } });
    }

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({ 
          contents: [{ parts }],
          generationConfig: { temperature: 0, maxOutputTokens: 1024 }
        })
      });

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      return '';
    }
  }

  private extractMimeType(base64: string): string | null {
    const match = base64.match(/^data:(.*);base64,/);
    return match ? match[1] : null;
  }
}
