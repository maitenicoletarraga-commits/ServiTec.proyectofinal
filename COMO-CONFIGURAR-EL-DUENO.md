# Cómo dejar listo el ADMIN para el dueño de ServiTec
(Esto lo hacés VOS una sola vez. El dueño después solo usa la página.)

## Idea importante
- Un cliente normal se registra y queda como **cliente**.
- Solo la cuenta del **dueño** debe ser **admin**.
- Eso se define en Supabase, no en un botón público (así nadie se hace admin solo).

---

## Pasos (una sola vez)

### 1. Subir el proyecto y conectar Supabase
- Pegá la URL y la anon key en `js/supabaseClient.js`
- Ejecutá `sql/schema.sql` en el SQL Editor de Supabase

### 2. Crear la cuenta del dueño
1. Abrí la web del proyecto
2. Tocá **Registrarse**
3. Usá el **correo real del dueño** (ej: servitec@gmail.com) y una contraseña que él elija
4. Anotá esa contraseña y entregásela

### 3. Convertirlo en administrador
1. Entrá a https://supabase.com → tu proyecto
2. Menú izquierdo → **Table Editor**
3. Tabla **profiles**
4. Buscá la fila con el correo del dueño
5. En la columna **role** cambiá `cliente` por **`admin`**
6. Guardá

### 4. Probar
1. Cerrá sesión en la web
2. Iniciá sesión con el correo y contraseña del dueño
3. Tiene que aparecer el link **Admin** (o entrar a `admin.html`)
4. Ahí ve:
   - Resumen de reservas
   - Cambiar precios de servicios
   - **Lista completa de todas las reservas** (cliente, teléfono, servicio, fecha, problema, estado)
   - Cambiar estado de cada reserva
   - Editar horarios / info

---

## Qué le explicás al dueño (en palabras simples)

> “Para ver las reservas y cambiar precios:
> 1. Entrá a la página de ServiTec
> 2. Iniciá sesión con tu correo y contraseña
> 3. Tocá **Admin**
> 4. Ahí ves todas las reservas nuevas y podés marcarlas como confirmadas o completadas.
> Cuando alguien reserva, también te puede llegar el aviso por WhatsApp si el cliente toca el botón de confirmar.”

---

## Notificaciones de reservas nuevas

En este proyecto (reglas: HTML/CSS/JS + Supabase, sin apps extra):

1. **Panel Admin** → el dueño entra y ve la columna/lista de **todas las reservas** (las nuevas en estado “pendiente”).
2. **WhatsApp** → al terminar una reserva, el cliente puede enviar automáticamente un mensaje al número del negocio con los datos.

No hace falta que el dueño sepa usar Supabase ni Vercel después de la configuración inicial.

---

## Seguridad
- No pongas un botón “hacerme admin” en la web.
- Solo vos (o alguien de confianza) puede cambiar el `role` en Supabase.
- Los clientes quedan siempre como `cliente`.
