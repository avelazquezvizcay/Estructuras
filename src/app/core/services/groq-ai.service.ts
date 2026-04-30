import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class GroqAiService {
  // API Key protegida en el archivo de entorno
  private readonly GROQ_API_KEY = environment.groqApiKey;
  // Usar el proxy para evitar el bloqueo por CORS en el navegador
  private readonly GROQ_API_URL = '/api/groq/openai/v1/chat/completions';

  // Historial de la conversación activo
  private readonly _messages = signal<ChatMessage[]>([]);
  public readonly messages = this._messages.asReadonly();
  
  public readonly isLoading = signal<boolean>(false);

  // Prompt de Sistema que define la personalidad y conocimiento del bot
  private readonly SYSTEM_PROMPT = `Eres un Asistente Virtual experto en el "Sistema de Estructura de Costos" (SEC). 
  Tu objetivo es ayudar a los usuarios del sistema a entender cómo funciona, resolver dudas frecuentes y guiarlos.
  Características del sistema SEC:
  - Permite crear insumos (con sus costos base, unidades de medida).
  - Permite crear productos finales (recetas) sumando insumos.
  - El sistema maneja múltiples monedas (USD y VES) y se conecta a tasas de cambio (BCV, Binance, Euro).
  - Permite generar presupuestos en PDF con niveles de precio (Detal, Mayor, Gran Mayor).
  Sé amable, conciso y profesional. Responde siempre en español.`;

  constructor() {
    this.loadHistory();
    // Si no hay historial, inicializamos con el prompt del sistema y un mensaje de bienvenida
    if (this._messages().length === 0) {
      this.resetChat();
    }
  }

  public async sendMessage(content: string): Promise<void> {
    if (!content.trim()) return;

    // 1. Agregar mensaje del usuario a la UI
    const userMsg: ChatMessage = { role: 'user', content, timestamp: new Date() };
    this._messages.update(msgs => [...msgs, userMsg]);
    this.saveHistory();

    this.isLoading.set(true);

    try {
      // 2. Preparar el payload para la API de Groq
      const payloadMessages = this._messages().map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(this.GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Modelo rápido y eficiente de Groq actualizado
          messages: payloadMessages,
          temperature: 0.7,
          max_tokens: 1024,
        })
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      const botReply = data.choices[0]?.message?.content || 'No pude generar una respuesta.';

      // 3. Agregar la respuesta del bot a la UI
      const assistantMsg: ChatMessage = { role: 'assistant', content: botReply, timestamp: new Date() };
      this._messages.update(msgs => [...msgs, assistantMsg]);
      this.saveHistory();

    } catch (error) {
      console.error('Error al conectar con Groq API:', error);
      const errorMsg: ChatMessage = { 
        role: 'assistant', 
        content: 'Lo siento, hubo un problema de conexión. Por favor intenta de nuevo más tarde.', 
        timestamp: new Date() 
      };
      this._messages.update(msgs => [...msgs, errorMsg]);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Procesa texto de OCR para extraer items de una factura usando IA
   */
  public async parseInvoiceText(ocrText: string, insumosDisponibles: {id: string, nombre: string}[], tasaVenta: number): Promise<any[]> {
    const prompt = `Actúa como un experto contable y extractor de datos. Analiza este texto de una factura (OCR) y extrae los artículos.
    
    Tasa de cambio actual: 1 USD = ${tasaVenta} Bs.
    
    Insumos registrados en mi sistema (Usa ESTOS IDs y NOMBRES si hay coincidencia):
    ${JSON.stringify(insumosDisponibles)}

    Texto de la factura:
    """
    ${ocrText}
    """

    REGLAS CRÍTICAS:
    1. IDENTIFICA LA MONEDA: Si los precios tienen "Bs" o son montos altos (ej. > 100 por un solo item), asume que es Bolívares (Bs).
    2. CONVERSIÓN: Si la factura está en Bs, DIVIDE cada precio unitario por la tasa (${tasaVenta}) para obtener el costo en USD.
    3. MATCHING: Sé inteligente. "Harina" en la factura debe mapearse a "Harina de Trigo" si existe en la lista. Si NO existe coincidencia, inventa un nombre genérico pero NO uses un ID al azar.
    4. CANTIDADES: Extrae la cantidad exacta (ej. "3x" o "Cant: 2").
    5. RESULTADO: Devuelve un array JSON de objetos con este formato:
       {
         "insumoId": "ID_SI_ES_COINCIDENCIA_EXACTA_O_MUY_ALTA", 
         "nombre": "NOMBRE_EN_FACTURA", 
         "cantidad": numero, 
         "costoUnitarioUsd": "decimal", 
         "subtotalUsd": "decimal",
         "categoria": "SUGERIDA",
         "unidad": "SUGERIDA",
         "sugerenciaId": "ID_DE_PRODUCTO_PARECIDO",
         "sugerenciaNombre": "NOMBRE_DE_PRODUCTO_PARECIDO"
       }
    
    LÓGICA DE SUGERENCIA:
    - Si el nombre en la factura es MUY parecido (ej. "Harina Robin" vs "Harina de Trigo Robin Hood"), ponlo directamente en 'insumoId'.
    - Si el nombre es algo parecido pero tienes dudas (ej. "Harina Robin" vs "Harina Pan"), deja 'insumoId' VACÍO y pon el ID y NOMBRE del parecido en 'sugerenciaId' y 'sugerenciaNombre'.
    
    UNIDADES VÁLIDAS: 'g', 'kg', 'ml', 'l', 'unidad'.
    CATEGORÍAS VÁLIDAS: 'Harinas', 'Lácteos', 'Proteínas', 'Grasas', 'Endulzantes', 'Saborizantes', 'Otros'.
    
    Responde ÚNICAMENTE con el JSON. Sin introducciones ni bloques de código.`;

    try {
      const response = await fetch(this.GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile', // Usar un modelo más potente para mejor razonamiento
          messages: [
            { role: 'system', content: 'Eres un extractor de facturas ultra-preciso que convierte Bolívares a Dólares si es necesario.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0, 
        })
      });

      if (!response.ok) throw new Error('Error en API de Groq');

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '[]';
      const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error('Error al procesar factura con IA:', error);
      return [];
    }
  }

  public resetChat(): void {
    this._messages.set([
      { role: 'system', content: this.SYSTEM_PROMPT },
      { role: 'assistant', content: '¡Hola! Soy el Asistente Virtual del SEC. ¿En qué te puedo ayudar hoy sobre la plataforma?', timestamp: new Date() }
    ]);
    this.saveHistory();
  }

  private saveHistory(): void {
    try {
      localStorage.setItem('sec_chat_history', JSON.stringify(this._messages()));
    } catch (e) {
      console.error('No se pudo guardar el historial del chat', e);
    }
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('sec_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        this._messages.set(parsed);
      }
    } catch (e) {
      console.error('No se pudo cargar el historial del chat', e);
    }
  }

  /**
   * Método genérico para generar contenido con Groq
   */
  public async generateContent(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.GROQ_API_KEY) return '';

    try {
      const response = await fetch(this.GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt || 'Eres un asistente útil y preciso.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
        })
      });

      if (!response.ok) return '';
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch {
      return '';
    }
  }
}
