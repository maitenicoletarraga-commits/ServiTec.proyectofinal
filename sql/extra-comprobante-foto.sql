-- Ejecutar en Supabase SQL Editor (si ya tenías el schema)
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS comprobante_imagen TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS pago_reportado_at TIMESTAMPTZ;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS comprobante_nota TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS visto_cliente BOOLEAN DEFAULT FALSE;
