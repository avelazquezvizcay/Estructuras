# Documentación Técnica: SEC (Sistema de Estructuras de Costos)

## Arquitectura Técnica

El sistema SEC está construido utilizando una arquitectura moderna de frontend enfocada en el rendimiento, la accesibilidad y la capacidad offline.

### Stack Tecnológico

- **Framework:** Angular 18 (Standalone Components, Signals)
- **Lenguaje:** TypeScript
- **Estilos:** SCSS (Arquitectura BEM, Variables CSS)
- **Base de Datos Local:** SQLite (mediante `better-sqlite3` en Electron)
- **Entorno de Ejecución:** Electron (Aplicación de Escritorio)
- **Procesamiento de Imágenes / OCR:** Tesseract.js (Local), Groq / Gemini Vision AI

### Estructura de Directorios (Core)

- `/electron`: Archivos del proceso principal de Electron (`main.js`, `preload.js`) y configuración de base de datos SQLite.
- `/src/app/core`: Servicios base (Bridge SQLite, IA, Tasas de cambio, Insumos, Autenticación).
- `/src/app/features`: Módulos de la aplicación (Dashboard, Compras, Insumos, Configuración, Usuarios).
- `/src/app/shared`: Componentes reutilizables (Modales, Botones, Layouts).

## Lógica de Base de Datos Local (SQLite)

La persistencia de datos ocurre de manera local y robusta utilizando un motor **SQLite** administrado por el proceso principal de Electron. La capa visual (Angular) se comunica con la base de datos a través de un puente seguro (IPC Bridge) en `preload.js`.

### Tablas Principales

1. **Insumos & Productos:** Almacena la materia prima, los productos elaborados y sus recetas (estructura relacional `items_receta`).
2. **Compras (Facturas):** Almacena el histórico de facturas subidas. Al registrarse, se utiliza una **transacción atómica** para actualizar el inventario de insumos y recalcular costos.
3. **Usuarios & Permisos:** Control de acceso local con roles (Master, Admin, Supervisor, Usuario) y gestión de visibilidad de módulos.
4. **Tasas de Cambio:** Almacena el historial de tasas BCV/Paralelo.

### Ventajas de esta Arquitectura

El uso de SQLite + Electron permite escalar el sistema de estructura de costos (SEC) hacia un sistema administrativo más completo en el futuro, ofreciendo verdaderas transacciones SQL, integridad referencial y mayor rendimiento en consultas complejas sobre Dexie.js/IndexedDB.

## Lógica de Versiones e Integración de IA

La arquitectura de Inteligencia Artificial para la lectura de facturas utiliza un enfoque **Híbrido (Edge + Cloud)**, diseñado para maximizar la velocidad y privacidad en dispositivos móviles (PWA):

1. **Extracción Local (Tesseract.js):** Las facturas se procesan primero a nivel local en el navegador del usuario utilizando OCR. Esto significa que la imagen pesada *nunca se sube a ningún servidor*, ahorrando datos y protegiendo la privacidad de la factura.
2. **Procesamiento de Lenguaje (Groq + Llama 3):** El texto crudo y desordenado extraído por el OCR se envía a la API ultrarrápida de Groq. El modelo de lenguaje (LLM) estructura este texto identificando "Cantidad, Insumo, Precio".
3. **Alternativa Premium (Gemini Vision API):** Integración implementada para lectura directa de imágenes (VLM) cuando se dispone de la API Key.

### ¿Por qué no usar un Modelo de Visión 100% Local (ej. PaliGemma / LLaVA)?
Aunque la tecnología WebGPU está avanzando rápidamente, los modelos multimodales (VLM) de visión artificial completos son aún demasiado pesados (requieren 4GB-8GB+ de RAM) para ejecutarse directamente en el navegador web de un teléfono celular promedio de manera fluida. El enfoque híbrido actual (OCR local ligero + LLM rápido en la nube) es el estándar óptimo de la industria para PWA.
