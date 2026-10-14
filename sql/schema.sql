-- =====================================================
-- SERVITEC - Crear tablas (ejecutar completo en Supabase)
-- =====================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  telefono TEXT,
  email TEXT,
  role TEXT DEFAULT 'cliente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servicios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_desde NUMERIC(10,2),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservas (
  id SERIAL PRIMARY KEY,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre_cliente TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  servicio_id INTEGER REFERENCES servicios(id),
  servicio_nombre TEXT,
  fecha DATE NOT NULL,
  horario TEXT NOT NULL,
  descripcion_problema TEXT,
  costo_reserva NUMERIC(10,2) DEFAULT 10,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finanzas del negocio (ingresos y gastos del admin)
CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  concepto TEXT NOT NULL,
  monto NUMERIC(10,2) NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    'cliente'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO servicios (nombre, descripcion, precio_desde) VALUES
  ('Reparación de PC', 'Hardware, fuente, placa madre, RAM y almacenamiento', 80),
  ('Reparación de laptop', 'Pantallas, teclados, bisagras, batería y refrigeración', 100),
  ('Software y sistema operativo', 'Formateo, Windows/Linux, drivers, virus y optimización', 50),
  ('Redes', 'Configuración de router, cableado y diagnóstico de red', 60),
  ('Periféricos', 'Impresoras, monitores, teclados, mouses y accesorios', 40),
  ('Mantenimiento preventivo', 'Limpieza interna, pasta térmica y revisión completa', 35)
ON CONFLICT DO NOTHING;

-- =====================================================
-- EXTRA (si ya corriste el schema antes, ejecutá esto también)
-- =====================================================

CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

INSERT INTO configuracion (clave, valor) VALUES
  ('abierto', 'true'),
  ('dias_habiles', '["1","2","3","4","5","6"]'),
  ('feriados', '[]')
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE reservas ADD COLUMN IF NOT EXISTS pago_reportado_at TIMESTAMPTZ;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS comprobante_nota TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS pago_reportado_at TIMESTAMPTZ;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS comprobante_nota TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS visto_cliente BOOLEAN DEFAULT FALSE;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS comprobante_imagen TEXT;
