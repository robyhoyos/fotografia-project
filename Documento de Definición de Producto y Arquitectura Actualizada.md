# Documento de Definición de Producto y Arquitectura Actualizada
## Aplicación de Gestión Fotográfica

Este documento consolida las mejoras arquitectónicas, de seguridad, UX/UI y el Product Backlog refinado para abordar las necesidades operativas reales del usuario (manejo masivo de clientes, subcategorías de eventos y flujos de caja).

---

## 1. Patrones de Diseño y Arquitectura (Refactorización)

La aplicación mantiene su base en **Electron + React + SQLite**, pero se deben integrar los siguientes patrones para garantizar escalabilidad:

*   **Repository Pattern (Backend/Main):** Abstraer las consultas de Prisma/SQLite. El IPC no debe llamar a Prisma directamente, sino a servicios (ej. `EventService.getAll()`). Esto facilita el testing y futuros cambios de ORM.
*   **Mediator / IPC Bridge Control:** Centralizar la comunicación a través del `preload.js` de Electron mediante un tipado estricto (TypeScript) para evitar canales IPC expuestos innecesariamente.
*   **State Management (Frontend/Renderer):** Implementar **Zustand** para el estado global (datos del negocio, settings) y **TanStack Query (React Query)** para la gestión del estado del servidor/DB (caché, re-fetching de la lista de participantes).
*   **Optimistic UI:** Al marcar un participante como "Entregado" o registrar un pago, la UI debe actualizarse instantáneamente mientras la petición viaja por IPC a SQLite.

---

## 2. Consideraciones de Seguridad

Dado que es una aplicación de escritorio local, los vectores de ataque son críticos a nivel de sistema:

*   **Context Isolation y Node Integration:** Obligatorio mantener `nodeIntegration: false` y `contextIsolation: true` en Electron. El frontend (React) **jamás** debe tener acceso al sistema de archivos (`fs`).
*   **Validación Estricta de Entradas (Zod):** Tanto en el Frontend (formularios) como en el Backend (handlers IPC). Prevenir inyección SQL (Prisma ya ayuda con esto, pero la lógica de negocio debe ser validada).
*   **Sanitización de Archivos:** Al subir logos o exportar PDFs, sanitizar los nombres de archivo para evitar Path Traversal en el OS local.
*   **Data Encryption (Opcional):** Si se manejan datos sensibles de menores (colegios), considerar cifrar la base de datos (SQLCipher).

---

## 3. UX / UI y Sistema de Diseño (Orientado a Fotografía)

*   **Paleta de Colores (Estilo Galería / Portfolio):**
    *   *Fondo:* Modo oscuro nativo (Gris carbón #121212) o Modo claro minimalista (Blanco tiza #FAFAFA).
    *   *Acentos:* Dorado/Ámbar suave para botones principales (denotando calidad/premium).
    *   *Estados semánticos:* Verde esmeralda (Entregado/Cancelado), Naranja quemado (Abono Parcial), Rojo coral (Debe).
*   **Interacciones:** Evitar modales que bloqueen toda la pantalla para edición. Usar "Drawers" (paneles laterales deslizables) para ver el detalle y pagos de un participante sin perder de vista la tabla del evento.

---

## 4. Product Backlog Refinado (Nuevas Historias de Usuario)

### ÉPICA B — Eventos (Actualizada)
**HU-B4. Subtipos de Evento**
*   **Como** fotógrafo, **quiero** clasificar eventos por subtipos (Bodas, Comuniones, Bautizos, Retratos familiares), **para** filtrar mejor.
*   **CA1:** El selector depende de una categoría padre (Sacramental, Estudio, Escolar).

### ÉPICA D — Participantes (Nuevas - CRÍTICAS)
**HU-D5. Importación Masiva (Excel/CSV)**
*   **Como** fotógrafo, **quiero** importar una lista de alumnos desde un Excel, **para** no tener que registrar 100 niños manualmente.
*   **CA1:** Modal con subida de archivo y mapeo de columnas (Nombre, Teléfono).
*   **CA2:** Validación de datos masiva antes de guardar en SQLite.

**HU-D6. Acciones en Lote (Bulk Actions)**
*   **Como** fotógrafo, **quiero** seleccionar múltiples participantes a la vez, **para** cambiar su estado (ej. "Entregado") en un solo clic.
*   **CA1:** Checkboxes en la tabla y barra flotante de acciones masivas.