-- Deja un solo servicio por nombre (el de id más bajo) y borra el resto
DELETE FROM servicios a
USING servicios b
WHERE a.id > b.id
  AND lower(trim(a.nombre)) = lower(trim(b.nombre));
