# Cómo subir ServiTec a Supabase + Vercel (paso a paso)

## A) Supabase (base de datos + login)

1. Creá cuenta en https://supabase.com y un proyecto nuevo.
2. **SQL Editor** → New query → pegá TODO `sql/schema.sql` → Run.
3. **Authentication → Providers → Email**
   - Enabled: sí
   - Para pruebas: desactivá “Confirm email” (así el registro funciona al toque).
4. **Project Settings → API**
   - Copiá **Project URL**
   - Copiá **anon public** key
5. Abrí `js/supabaseClient.js` y reemplazá:
   ```js
   const SUPABASE_URL = "https://xxxx.supabase.co";
   const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```

## B) Cuenta del dueño (admin)

1. Con la web abierta (local o ya en Vercel), **Registrarse** con el correo del dueño.
2. En Supabase → **Table Editor → profiles**
3. En esa fila, `role` = **admin** (antes decía cliente).
4. El dueño inicia sesión en la web → ve **Admin** → gestiona reservas y precios.

## C) Vercel (subir la página)

1. Subí la carpeta `servitec` a GitHub (o arrastrá en Vercel).
2. https://vercel.com → Add New Project → importá el repo / carpeta.
3. Framework preset: **Other** (es HTML estático).
4. Root directory: la carpeta donde está `index.html`.
5. Deploy.

No hace falta build ni npm.

## D) Probar

- Inicio, Información, Reservas, Ubicación, Contacto
- Registrarse / Iniciar sesión
- Reservar (debe pedir login)
- Entrar como admin y ver la lista de reservas

Si algo falla al registrar: revisá que Email Auth esté activo y que URL/key estén bien en `supabaseClient.js`.
