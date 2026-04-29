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
    if (!apiKey) {
      console.warn('Gemini API Key no configurada.');
      return { items: [] };
    }

    this.isLoading.set(true);

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
             "categoria": "Harinas|Lácteos|Proteínas|Grasas|Endulzantes|Saborizantes|Otros",
             "unidad": "g|kg|ml|l|unidad",
             "sugerenciaId": "id_parecido",
             "sugerenciaNombre": "nombre_parecido"
           }
         ]
       }`;

    try {
      // Remover el prefijo data:image/...;base64, si existe
      const cleanBase64 = base64Image.split(',')[1] || base64Image;

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: cleanBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 4096,
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error en Gemini API');
      }

      const result = await response.json();
      const content = result.candidates[0]?.content?.parts[0]?.text || '[]';
      
      console.log('--- RAW GEMINI RESPONSE ---');
      console.log(content);
      console.log('---------------------------');

      // Extraer el objeto JSON buscando el primer { y el último }
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      
      if (start === -1 || end === -1) {
        console.error('No se encontró un objeto JSON en la respuesta de Gemini');
        return { items: [] };
      }

      let jsonStr = content.substring(start, end + 1);
      
      // Limpiar comas finales (ej: [ {...}, ]) que rompen el parser JSON
      jsonStr = jsonStr.replace(/,\s*]/g, ']');
      jsonStr = jsonStr.replace(/,\s*}/g, '}');

      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Error analizando factura con Gemini:', error);
      return { items: [] };
    } finally {
      this.isLoading.set(false);
    }
  }
}
