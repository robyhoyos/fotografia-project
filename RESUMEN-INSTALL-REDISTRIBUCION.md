# 📋 GUÍA DE INSTALACIÓN Y DISTRIBUCIÓN — Gestión Fotográfica v2.0.0

> Documento para **quien distribuye** (tú) y para **el usuario final**.
> La aplicación está **sin firmar** (no se contrató certificado por su costo).
> Por eso Windows mostrará avisos de SmartScreen la primera vez. Es normal y se explica abajo.

> 🆕 **Novedades v2.0** (respecto a v1.0):
> - Nuevas categorías/subtipos de eventos: **Vasos y Camisetas**, **Bodas y 15 años**, **Marketing Digital**.
> - Campo **Dirección** opcional en participantes (manual y por importación CSV).
> - Botón **"Corregir pago"** para eliminar un pago registrado por error (recalcula el saldo).
> - **Logo** del negocio: aparece en la pantalla de Ajustes, en el menú lateral y en la factura PDF.
> - Rol **Ayudante** (lectura compartida) ahora también puede registrar pagos, corregir pagos y generar recibos.
> - Nota: la base de datos **v1 es compatible**; al abrir la v2.0 se actualiza automáticamente a la estructura nueva.

---

## PARTE A — QUÉ DEBES DISTRIBUIR (para ti)

Los instaladores ya están generados en la carpeta `dist-app\`:

| Archivo | Uso | Tamaño |
|---------|-----|--------|
| `Gestión Fotográfica Setup 2.0.0.exe` | Instalador completo (asistente guiado) | ~150 MB |
| `Gestión Fotográfica 2.0.0.exe` | Portable (sin instalar, directo) | ~150 MB |

### A.1 Cómo envías el archivo
Puedes usar cualquiera de estos medios; la app es un `.exe` normal de Windows:
- **Correo electrónico**: adjuntar el `.exe`. Ojo: muchos servidores de correo bloquean .exe por seguridad.
  - ✅ Si falla, **comprímelo en un .zip** (`Gestión-Fotografica-v2.0.0.zip`) y adjunta el zip.
- **USB / memoria**: copiar el `.exe` a la raíz.
- **Carpeta compartida / red**: copiar el `.exe` a la carpeta.
- **Google Drive / OneDrive / WeTransfer**: subir el `.exe` y compartir el enlace de descarga.

> 📌 Recomendación: envía el **Setup .exe** (instalación) como opción principal y, opcionalmente, el **portable** como alternativa.

### A.2 Qué debes evitar
- NO envíes el archivo dentro de `.zip` con contraseña si el usuario no es técnico (complicarás la instalación).
- NO envíes la subcarpeta suelta `win-unpacked\` (es el código descompilado; solo sirve para pruebas).

---

## PARTE B — INSTALACIÓN EN LA PC DEL USUARIO (paso a paso)

> Requisitos mínimos: **Windows 10 o 11 (64 bits)**. No requiere internet ni permisos de administrador.

### Opción 1 — Instalación completa (recomendada)

1. Recibe el archivo **`Gestión Fotográfica Setup 2.0.0.exe`** (o extráelo si venía en un `.zip`).
2. **Doble clic** sobre el archivo.
3. Si Windows muestra un aviso azul **"Windows protegió su equipo"** o **"Editor desconocido"**:
   - Haz clic en **"Más información"** (o texto en la esquina inferior).
   - Luego clic en **"Ejecutar de todas formas"**.
4. Se abre el **asistente de instalación** de Gestión Fotográfica. Haz clic en **Siguiente** / **Next** en cada pantalla.
5. En la pantalla **Carpeta de instalación**, deja el valor por defecto y haz clic en **Siguiente**.
6. Espera a que termine la barra de progreso y haz clic en **Finalizar**.
7. Se crean dos accesos directos: en el **Escritorio** y en el **Menú Inicio**.
8. Abre la app con doble clic en el acceso directo "Gestión Fotográfica".
9. **La primera vez** la app se prepara sola (crea su base de datos automáticamente). No toques nada hasta que aparezca la ventana principal. Tarda unos segundos.

### Opción 2 — Portable (sin instalar)

1. Recibe el archivo **`Gestión Fotográfica 2.0.0.exe`**.
2. Guárdalo en una carpeta fija, por ejemplo `C:\Usuarios\TuUsuario\Documentos\Gestión Fotográfica\`.
3. **Doble clic** en el .exe. Se abre igual que la app instalada.
4. No crea accesos directos automáticamente. Si quieres uno: clic derecho sobre el .exe → **Enviar a** → **Escritorio**.

> ⚠️ **Importante para el portable:** deja el .exe siempre en la misma carpeta. Los datos NO se guardan junto al .exe, sino en la carpeta del usuario (ver PARTE C). Puedes mover el .exe sin perder datos, pero el usuario debe saber hacer doble clic siempre en el mismo archivo.

---

## PARTE C — DÓNDE VIVEN LOS DATOS (respaldo y transferencia)

- La base de datos se guarda en:
  `C:\Usuarios\<USUARIO>\AppData\Roaming\fotografia-app\dev.db`
  *(en inglés: `C:\Users\<USUARIO>\AppData\Roaming\fotografia-app\dev.db`)*
- La app genera **respaldos automáticos** en la subcarpeta `backups\`.
- Para **transferir datos** de una PC a otra: copia `dev.db` (y si quieres, la carpeta `backups`) y pégala en la misma ubicación en la otra PC, **con la app cerrada**.

---

## PARTE D — PROBLEMAS FRECUENTES (qué hacer)

| Problema | Causa | Solución |
|----------|-------|----------|
| "Windows protegió su equipo" | App sin firmar | Clic en **Más información → Ejecutar de todas formas** |
| El antivirus avisa/borra el .exe | App sin firmar (falso positivo común) | Agregar excepción o descargar de nuevo; es un .exe legítimo |
| El correo rechaza el .exe | Servidor bloquea ejecutables | Comprimir en `.zip` y adjuntar el zip |
| La app abre pero no aparece la ventana | Primer arranque lent (crea BD) | Aceptar y esperar ~30 s; no cerrar |
| Doble clic no hace nada | Descarga corrupta | Descargar de nuevo desde el medio original |
| No recuerda los datos | BD en otra PC | Ver PARTE C (transferir `dev.db`) |

---

## PARTE E — PARA PRUEBAS TUYAS ANTES DE DISTRIBUIR

Si quieres comprobar siempre que el instalador funciona nuevo:
- La instalación completa crea la BD en `AppData\Roaming\fotografia-app\dev.db`.
- Para simular un "primer uso" limpio, cierra la app y borra esa carpeta `fotografia-app`, luego vuelve a abrir (la regenera sola).

---

## CÓMO CAMBIAR EL NÚMERO DE VERSIÓN PARA LA SIGUIENTE ENTREGA
Cuando hagas una nueva versión:
1. Sube la versión en `package.json` (campo `"version"`).
2. Ejecuta `npm run dist`.
3. Se generarán de nuevo los archivos en `dist-app\` con el nuevo número.
4. Reparte el nuevo **Setup .exe** igual que la primera vez.
