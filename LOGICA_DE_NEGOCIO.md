# LÓGICA DE NEGOCIO — FotoApp (Gestión Fotográfica)

> **Propósito de este documento:** Registrar la lógica completa del negocio y de la aplicación para que cualquier desarrollador (humano o IA) entienda qué se está construyendo, por qué, y cuáles son las reglas que no se deben romper.
> **Última actualización:** 28 de agosto de 2026

---

## 1. QUÉ ES LA APLICACIÓN

FotoApp es una aplicación de escritorio (Electron + React + SQLite) para **fotógrafos independientes**.

El fotógrafo cubre **eventos** (comuniones, bodas, bautizos, retratos escolares, sesiones de estudio, eventos corporativos). Para cada evento registra **participantes** (los clientes a quienes fotografió y a quienes debe **cobrar** y **entregar** lo que pagaron). El ciclo de vida es: **crear evento → registrar participantes → cobrar → entregar**.

El negocio NO es gestionar fotos (todavía): es gestionar **clientes por evento**, su **estado de pago** y su **estado de entrega**.

---

## 2. MODELO DE NEGOCIO (Jerarquía)

```
Evento (1) ────── tiene muchos ──────► Participante (N) ──── tiene muchos ────► Pago (N)
   │                                        │
   ├─ Categoría (SACRAMENTAL / ESCOLAR / ESTUDIO)          ├─ Estado de entrega (PENDIENTE, EN_PROCESO, ENTREGADO, CANCELADO)
   ├─ Subtipo (depende de la categoría)                    ├─ Estado de pago (SIN_PAGO, PAGO_PARCIAL, PAGO_TOTAL)
   ├─ Fecha, lugar, notas                                  ├─ Barcode único (rastreo y entrega por escáner)
   └─ Precio base por participante (coverPrice)            └─ Cantidad + Precio unitario (override del evento)
```

**Regla estructural clave:** un participante **siempre pertenece a un evento** (`eventId` es obligatorio y es llave foránea). No existen participantes "sueltos". Los eventos se eliminan en cascada con sus participantes y pagos.

---

## 3. ACTORES

| Actor | Qué hace |
|-------|----------|
| **Fotógrafo (usuario)** | Crea eventos, registra/importa participantes, cobra, marca entregas, imprime y exporta. |
| **Participante/cliente** | Persona registrada en un evento. Paga (parcial o total) y recibe el material fotográfico. |

No hay roles múltiples ni multiusuario: es una herramienta local de un solo fotógrafo/estudio.

---

## 4. CATEGORÍAS Y SUBTIPOS DE EVENTO

| Categoría | Subtipos |
|-----------|----------|
| **SACRAMENTAL** | BODA, COMUNION, BAUTIZO, CONFIRMACION |
| **ESCOLAR** | RETRATO_GRUPO, ANUARIO, GRADUACION |
| **ESTUDIO** | RETRATO_FAMILIAR, RETRATO_INDIVIDUAL, BOOK_FOTOGRAFICO, EVENTO_CORPORATIVO |

- El **selector de subtipo depende de la categoría padre** (se filtra en el frontend y se valida en el backend).
- Permitir hoy: crear/editar eventos en cualquier categoría, incluida ESTUDIO (que puede ser retroactivo, ver reglas).

---

## 5. FLUJOS PRINCIPALES

### 5.1 Crear un evento
1. En la vista de lista de eventos, el usuario pulsa **"Nuevo Evento"**.
2. Dibujante de eventos (`EventDrawer`, modo Crear) captura: nombre, categoría, subtipo, fecha y hora, lugar, precio por participante (COP) y notas.
3. `EventService.create()` valida la regla de fecha (ver §6) y persiste con estado inicial **ACTIVO**.

### 5.2 Registrar participantes dentro de un evento
1. El usuario selecciona un evento de la lista → entra a su **detalle**.
2. Dentro del detalle se usa **"Nuevo Participante"** (o **"Importar CSV"** para carga masiva).
3. El drawer de participantes (`ParticipantDrawer`, modo Crear) captura: nombre, **cédula (número de documento, opcional)**, teléfono, email, cantidad, precio unitario (opcional) y notas.
4. `ParticipantService.create()` valida que el evento **exista y no esté CANCELADO** y persiste el participante con:
   - Estado de entrega: `PENDIENTE`
   - Estado de pago: `SIN_PAGO`, monto pagado `0.00`
   - **Barcode único** generado automáticamente (rastreo/entrega).

### 5.3 Cobrar (registrar pagos)
1. Desde el detalle del participante se abre el módulo de **pagos**.
2. Se registran transacciones (monto, método, notas) → ledger `Payment`.
3. El monto pagado se acumula en `paidAmount` y el estado de pago se recalcula:
   - `0` pagado → `SIN_PAGO`
   - `0 < pagado < total` → `PAGO_PARCIAL`
   - `pagado >= total` → `PAGO_TOTAL`
4. Métodos de pago configurados: efectivo, transferencia, Nequi, Daviplata, otro.

### 5.4 Entregar
1. El fotógrafo puede usar el **escáner de código de barras** (por evento) para buscar al participante y marcarlo como entregado.
2. También puede cambiar el estado manualmente (individual o **masivo**).
3. Regla crítica de negocio: **no se entrega sin haber pagado al menos el porcentaje mínimo configurado** (`delivery_payment_threshold`, por defecto 50%, ver §6).

### 5.5 Cierre y operaciones del día
- Exportar participantes del evento a **CSV** (compatible con Excel).
- **Imprimir** listas y reportes.
- Generar **recibos PDF** por participante.
- **Respaldar/restaurar** la base de datos local.

---

## 6. REGLAS DE NEGOCIO (vigentes)

| # | Regla | Dónde se aplica |
|---|-------|-----------------|
| R1 | No se pueden crear eventos con **fecha en el pasado**, excepto categoría `ESTUDIO` (los eventos de estudio pueden ser retroactivos). | `EventService.create()` |
| R2 | No se pueden **modificar** eventos en estado `CANCELADO`. | `EventService.update()` |
| R3 | No se puede **eliminar** un evento que tenga participantes `ENTREGADO` (primero se cancela). | `EventService.delete()` |
| R4 | No se puede **agregar un participante** a un evento que **no existe** o está `CANCELADO`. | `ParticipantService.create()` |
| R5 | Para marcar un participante `ENTREGADO` debe haber pagado al menos el **porcentaje mínimo configurable** (`delivery_payment_threshold`, por defecto 50%) sobre el total adeudado. | `ParticipantService.update()` y `bulkUpdateStatus()` |
| R6 | Un participante `CANCELADO` **no** puede volver a `EN_PROCESO` (no se reactiva). | `ParticipantService.update()` |
| R7 | Acciones masivas limitadas a **máximo 500 participantes** por operación. | Schemas Bulk |
| R8 | Importación CSV limitada a **máximo 1000 registros** por archivo. | `ImportCsvSchema` |
| R9 | La importación **no duplica** participantes por nombre dentro del mismo evento (se omiten los repetidos y se reporta). | `ParticipantService.importCsv()` |
| R10 | Todo participante recibe un **barcode único** para rastreo y entrega. | `ParticipantRepository.create()` |
| R11 | Los pagos se registran como **transacciones** (ledger), nunca solo como un campo acumulado. | `PaymentService` |
| R12 | La **cédula** del participante es **opcional**, acepta solo **dígitos (4 a 12)** y se usa para **filtrar/buscar**, **exportar/importar** y **reutilizar el dato** en futuros trabajos. No hay registro central de personas (cada evento la guarda en su participante). | Schemas compartidos, `ParticipantRepository`, CSV, recibo PDF |

---

## 7. ESTADOS Y TRANSICIONES

### 7.1 Estado de entrega (`Participant.status`)
```
PENDIENTE ──► EN_PROCESO ──► ENTREGADO
   │               ↑              │
   │               └── (prohibido si CANCELADO)
   └────────────► CANCELADO (sin retorno a EN_PROCESO)
```
- `ENTREGADO` requiere **R5** (alcanzar el umbral configurable de pago mínimo, por defecto 50% del total adeudado).

### 7.2 Estado de pago (`Participant.paymentStatus`)
```
SIN_PAGO ──► PAGO_PARCIAL ──► PAGO_TOTAL        (basado en paidAmount vs total)
```

### 7.3 Estado de evento (`Event.status`)
```
ACTIVO ──► FINALIZADO
   └──────► CANCELADO   (no editable, no recibe participantes, elimina solo si nadie entregó)
```

---

## 8. DATOS QUE SE GUARDAN DEL PARTICIPANTE (para cobrar y entregar)

Por participante se persisten los datos necesarios para **facturar/cobrar** y **entregar** lo que pagó:

| Dato | Uso |
|------|-----|
| Nombre | Identidad del cliente |
| **Cédula / Nº de documento** | **Identificación inequívoca del cliente; permite filtrar/buscar y reutilizar el dato en futuros trabajos** |
| Teléfono / Email | Contacto para avisar entrega y coordinar cobros |
| Cantidad | Nº de copias/fotos que compró |
| Precio unitario (override) | Si difiere del precio base del evento |
| Estado de entrega + fecha de entrega | Control de quién ha recibido su material |
| Estado de pago + monto pagado | Cuánto debe y cuánto ha abonado |
| Ledger de Pagos (transacciones) | Historial completo de abonos |
| Barcode | Referencia física al material / entrega con escáner |
| Notas | Observaciones por cliente |

---

## 9. REGLAS DE PRECIO

- El **precio de referencia** es el `coverPrice` del evento (precio base por participante).
- Un participante puede tener un **`unitPrice` propio** (override) que reemplaza al del evento al calcular totales.
- **Total a pagar** = `unitPrice (o coverPrice) × quantity`.
- **Pendiente** = Total − `paidAmount`.

---

## 10. IDEA DE NEGOCIO — VISIÓN A FUTURO (no implementado todavía)

Cosas que el negocio necesita y que aún no están en el código (para tener presente hacia dónde va la app):

1. **Módulo de fotografías / inventario por participante** — asociar fotos al participante y al evento (subir, previsualizar, entregar digitalmente). La app por ahora gestiona clientes, cobros y entregas; las fotos son el siguiente gran bloque.
2. **Paquetizado / planes por evento** — paquetes de fotos con precios distintos (solo digital, impresiones, marcos, etc.).
3. **Exportación a Excel (.xlsx)** además de CSV.
4. **Respaldo automático** programado de la base de datos.
5. **Reportes de ingresos por evento/período** consolidados.
6. **Empaquetado** de la app para distribución (`electron-builder`: `.exe` para Windows, `.dmg` para macOS).
7. **Tests automatizados** (actualmente 0% cobertura).

---

## 11. GLOSARIO

| Término | Significado |
|---------|-------------|
| Evento | Sesión fotográfica programada que el fotógrafo va a cubrir (comunión, boda, retrato escolar, etc.). |
| Participante | Cliente registrado dentro de un evento; es a quien se cobra y entrega. |
| Cover price | Precio base por participante definido en el evento. |
| Barcode | Código único generado por participante para rastrear y entregar material. |
| Ledger | Historial de transacciones de pago de un participante. |
| ENTREGADO | El participante ya recibió el material por el que pagó. |

---

*Este documento es la fuente de verdad de la lógica de negocio. Si un cambio de código contradice algo aquí, primero actualiza este documento.*