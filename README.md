# ServiTec — Proyecto de grado

## Cómo entrar como ADMINISTRADOR

El admin **usa el mismo sistema de login** (correo + contraseña).
La diferencia es el campo `role` en la tabla `profiles`.

### Pasos:

1. Completá URL y anon key en `js/supabaseClient.js`
2. Ejecutá `sql/schema.sql` en Supabase SQL Editor
3. En Supabase → Authentication → Providers → Email: activado
   (desactivá "Confirm email" para pruebas)
4. Entrá a la web → **Registrarse** con tu correo y una contraseña
5. En Supabase → **Table Editor → profiles**
6. Buscá tu usuario y cambiá `role` de `cliente` a **`admin`**
7. Cerrá sesión y volvé a iniciar sesión
8. Vas a ver el link **Admin** en la barra → o entrá a `admin.html`

Correo y contraseña = los que usaste al registrarte.
No hay una contraseña “especial” aparte: se controla por el rol.

---

## Qué puede hacer el ADMIN (panel)

- **Resumen**: cantidad de reservas pendientes, de hoy, total, servicios
- **Precios y servicios**: cambiar precios de cada servicio
- **Gestionar reservas**: cambiar estado (pendiente / confirmada / completada / cancelada)
- **Horarios / info**: editar textos de horario, dirección, teléfono, notas

El usuario normal **no** ve ni puede entrar a este panel.

---

## Flujo del cliente

1. Va a Reservas → ve tarjeta “Iniciá sesión / Registrarse”
2. Se registra o inicia sesión
3. Completa el formulario (ve el **costo estimado** según el servicio)
4. Al enviar → pantalla **¡Listo!** con resumen, monto y botón WhatsApp para confirmar/pago

---

## Archivos

index, informacion, reservas, ubicacion, contacto, admin,
css/style.css, js/supabaseClient.js, js/app.js,
sql/schema.sql, sql/migracion_rls.sql
