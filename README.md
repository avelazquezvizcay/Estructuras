# SEC - Sistema de Estructura de Costos

Esta es tu hoja de referencia para administrar, actualizar y compilar el proyecto **SEC** (Sistema de Estructura de Costos) sin necesidad de ayuda.

## 1. 🛠️ Probar la App Localmente (Modo Desarrollo)
Úsalo cuando hagas cambios en el código y quieras verlos en tu computadora o en tu celular conectado al mismo WiFi.
```powershell
npm start -- --host 0.0.0.0
```
> *Para detener el servidor, presiona `Ctrl + C` en tu terminal.*

## 2. 💾 Guardar Cambios en la Nube (GitHub)
Cada vez que hagas un cambio importante (como agregar recetas, lógica o actualizaciones), debes respaldarlo en tu repositorio privado.
```powershell
git add .
git commit -m "Descripción de tu actualización aquí"
git push origin main
```

## 3. 🌐 Actualizar la Versión Web / PWA
Si tienes la aplicación desplegada en un servidor o servicio como Vercel/Render y quieres que todo el mundo vea la nueva versión.
```powershell
# Ejemplo para Vercel:
vercel --prod
```

## 4. 🚀 Compilar para Producción (Archivos Estáticos)
Cuando necesites crear los archivos finales minimizados para subirlos a tu servidor, cPanel, Vercel o cualquier hosting.
```powershell
npm run build
```
> Los archivos listos para subir se generarán en la carpeta `dist/sec/browser`.

## 5. 📦 Funcionalidades Principales Activas
- **Dashboard & KPIs:** Vista general de costos, insumos y márgenes.
- **Gestión de Tasas:** Múltiples fuentes (BCV Oficial, Binance P2P, DolarAPI) con modo offline (historial en Dexie.js).
- **Carga de Facturas con IA:** Lectura automática de facturas mediante Gemini Pro (Visión) para extraer fecha, proveedor, insumos y aplicar la tasa correspondiente automáticamente.
- **Generación de Reportes PDF:** Exportación nativa de Estructura de Costos, Valorización de Inventario e Historial de Inflación directamente a PDF.
- **Simulador de Producción:** Cálculo dinámico de costos por lote.
- **Presupuestos & Exportación:** Selección de productos en combo y generación de PDFs formales.
- **Asistente Virtual IA:** Integración con IA para soporte en costos.
- **Respaldos (Backups):** Exportación en JSON y envíos seguros.

## 6. 📝 Documentación Adicional
- **[DOCUMENTACION.md](./DOCUMENTACION.md):** Arquitectura técnica, lógica de versiones y base de datos local Dexie.

---
*Fin de Fase 1. Sistema listo para Producción.*
