-- =====================================================
-- SERVITEC - Migración de políticas RLS
-- -----------------------------------------------------
-- Ejecutar SOLO cuando el profesor lo pida.
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

-- PROFILES: cada usuario ve/edita solo el suyo
CREATE POLICY "Ver propio perfil" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Editar propio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Insertar propio perfil" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RESERVAS: usuarios ven solo las suyas; admin verá todo desde el panel (con service o bypass)
CREATE POLICY "Ver propias reservas" ON reservas FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "Crear propias reservas" ON reservas FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Actualizar propias reservas" ON reservas FOR UPDATE USING (auth.uid() = usuario_id);

-- SERVICIOS: lectura pública; escritura solo autenticados (admin lo usa)
CREATE POLICY "Ver servicios activos" ON servicios FOR SELECT USING (activo = true OR auth.role() = 'authenticated');
CREATE POLICY "Admin gestiona servicios" ON servicios FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
