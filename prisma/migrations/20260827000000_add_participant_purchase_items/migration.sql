-- AlterTable
-- Agrega soporte al "Detalle de Compra" (patrón carrito/factura).
-- `items` almacena un array JSON de ítems de compra del participante.
-- `totalAmount` guarda la suma de subtotales para no recalcular sobre el JSON.
ALTER TABLE "Participant" ADD COLUMN "items" TEXT;
ALTER TABLE "Participant" ADD COLUMN "totalAmount" REAL NOT NULL DEFAULT 0.0;
