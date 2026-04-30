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

## 3. 🌐 Empaquetar la Aplicación (Electron)
Si deseas generar el instalador `.exe` para instalar el programa de forma nativa en Windows:
```powershell
npm run electron:build
```
> El instalador final se generará en la carpeta `dist-electron`.

## 4. 🚀 Compilar para Producción (Web / Frontend)
Cuando necesites crear los archivos finales minimizados de Angular:
```powershell
npm run build
```
> Los archivos listos se generarán en la carpeta `dist/sec/browser`.

## 5. 📦 Funcionalidades Principales Activas
- **Dashboard & KPIs:** Vista general de costos, insumos y márgenes.
- **Gestión de Tasas:** Múltiples fuentes (BCV Oficial, Binance P2P, Euro) con historial almacenado en SQLite.
- **Carga de Facturas con IA:** Lectura automática de facturas mediante Gemini Pro (Visión) u OCR Local + Groq para extraer fecha, proveedor, insumos y actualizar el stock.
- **Generación de Reportes PDF:** Exportación nativa de Estructura de Costos, Valorización de Inventario e Historial de Inflación directamente a PDF.
- **Simulador de Producción y Recetas:** Cálculo dinámico de costos por lote mediante una estructura relacional.
- **Control de Acceso y Permisos:** Roles de usuario (Master, Admin, Supervisor, Usuario) gestionados localmente.
- **Respaldos (Backups):** Exportación completa de la base de datos a JSON y restauración.

## 6. 📝 Documentación Adicional
- **[DOCUMENTACION.md](./DOCUMENTACION.md):** Arquitectura técnica basada en Electron + SQLite.

---
*Fin de Fase 1. Sistema listo para Producción.*
