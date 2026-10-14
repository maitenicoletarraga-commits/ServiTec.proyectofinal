/* =====================================================
   SERVITEC - Lógica principal
   ===================================================== */

let usuarioActual = null;
let perfilActual = null;

/** true solo si Supabase cargó bien */
function clienteListo() {
  return !!(window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.signUp === "function");
}

function avisarSinSupabase() {
  const detalle = window.__servitecSupabaseMsg && window.__servitecSupabaseMsg !== "ok"
    ? window.__servitecSupabaseMsg
    : "Revisá URL/anon key en js/supabaseClient.js y usá Live Server (no abras el HTML a lo directo).";
  mostrarToast("No se puede registrar: " + detalle, "error");
}

// ---------- CONFIG LOCAL (abierto / días / feriados) ----------
let configNegocio = {
  abierto: true,
  dias_habiles: ["1", "2", "3", "4", "5", "6"], // 0=dom ... 6=sab
  feriados: []
};
let reservaPendientePago = null; // datos del form hasta que pague

async function cargarConfigNegocio() {
  // 1) localStorage
  try {
    const local = localStorage.getItem("servitec_config_negocio");
    if (local) configNegocio = { ...configNegocio, ...JSON.parse(local) };
  } catch (e) {}
  // 2) Supabase si existe tabla configuracion
  if (clienteListo()) {
    try {
      const { data } = await window.supabaseClient.from("configuracion").select("clave, valor");
      if (data && data.length) {
        data.forEach((row) => {
          if (row.clave === "abierto") configNegocio.abierto = row.valor === "true";
          if (row.clave === "dias_habiles") {
            try { configNegocio.dias_habiles = JSON.parse(row.valor); } catch (e) {}
          }
          if (row.clave === "feriados") {
            try { configNegocio.feriados = JSON.parse(row.valor); } catch (e) {}
          }
        });
        localStorage.setItem("servitec_config_negocio", JSON.stringify(configNegocio));
      }
    } catch (e) {
      console.warn("configuracion table:", e);
    }
  }
  pintarEstadoLocal();
}

async function guardarConfigNegocio(cfg) {
  configNegocio = { ...configNegocio, ...cfg };
  localStorage.setItem("servitec_config_negocio", JSON.stringify(configNegocio));
  if (clienteListo()) {
    const rows = [
      { clave: "abierto", valor: String(configNegocio.abierto) },
      { clave: "dias_habiles", valor: JSON.stringify(configNegocio.dias_habiles || []) },
      { clave: "feriados", valor: JSON.stringify(configNegocio.feriados || []) }
    ];
    for (const r of rows) {
      try {
        await window.supabaseClient.from("configuracion").upsert(r);
      } catch (e) {
        console.warn(e);
      }
    }
  }
  pintarEstadoLocal();
}

function pintarEstadoLocal() {
  const banner = document.getElementById("estadoLocalBanner");
  if (!banner) return;
  if (configNegocio.abierto) {
    banner.style.display = "block";
    banner.style.background = "#EAF3DE";
    banner.style.color = "#3B6D11";
    banner.textContent = "Local ABIERTO — podés solicitar reserva (sujeto a días hábiles y feriados)";
  } else {
    banner.style.display = "block";
    banner.style.background = "#FCE8E8";
    banner.style.color = "#A31B1B";
    banner.textContent = "Local CERRADO — por ahora no se aceptan reservas nuevas";
  }
}


// ---------- DATOS DEL LOCAL (admin → todo el sitio) ----------
function leerDatosLocal() {
  try {
    return JSON.parse(localStorage.getItem("servitec_admin_info") || "{}");
  } catch (e) {
    return {};
  }
}

async function sincronizarDatosLocalDesdeSupabase() {
  if (!clienteListo()) return;
  try {
    const { data } = await window.supabaseClient.from("configuracion").select("clave, valor");
    if (!data || !data.length) return;
    const info = leerDatosLocal();
    data.forEach((row) => {
      if (row.clave === "local_horario") info.horario = row.valor;
      if (row.clave === "local_direccion") info.direccion = row.valor;
      if (row.clave === "local_telefono") info.telefono = row.valor;
      if (row.clave === "local_nota") info.nota = row.valor;
    });
    localStorage.setItem("servitec_admin_info", JSON.stringify(info));
      await guardarDatosLocalRemoto(info);
      aplicarDatosLocal();
  } catch (e) {
    console.warn("sync local:", e);
  }
}

async function guardarDatosLocalRemoto(info) {
  if (!clienteListo()) return;
  const rows = [
    { clave: "local_horario", valor: info.horario || "" },
    { clave: "local_direccion", valor: info.direccion || "" },
    { clave: "local_telefono", valor: info.telefono || "" },
    { clave: "local_nota", valor: info.nota || "" }
  ];
  for (const r of rows) {
    try {
      await window.supabaseClient.from("configuracion").upsert(r);
    } catch (e) {
      console.warn(e);
    }
  }
}

function aplicarDatosLocal() {
  const info = leerDatosLocal();
  const dir = (info.direccion || "Colegio Juana Azurduy de Padilla, Satélite Norte").trim();
  const tel = (info.telefono || "+591 78118558").trim();
  const hor = (info.horario || "Lunes a Sábado: 8:00 – 19:00\nDomingo: cerrado").trim();
  const horLinea = hor.replace(/\n+/g, " · ");
  const horHtml = hor.replace(/\n/g, "<br/>");

  document.querySelectorAll(".footer-info").forEach((el) => {
    const t = el.textContent || "";
    if (t.includes("Panel privado")) return;
    el.innerHTML = `${dir} &nbsp;·&nbsp; <strong>${tel}</strong><br/>${horLinea} &nbsp;·&nbsp; servitec@email.com`;
  });

  document.querySelectorAll("[data-local='direccion']").forEach((el) => {
    el.innerHTML = dir.replace(/\n/g, "<br/>");
  });
  document.querySelectorAll("[data-local='direccion-sub']").forEach((el) => {
    el.textContent = dir.replace(/\n/g, " ");
  });
  document.querySelectorAll("[data-local='horario']").forEach((el) => {
    el.innerHTML = horHtml;
  });
  document.querySelectorAll("[data-local='telefono']").forEach((el) => {
    if (el.tagName === "STRONG" || el.querySelector("strong")) {
      el.innerHTML = `<strong>${tel}</strong>`;
    } else {
      el.textContent = tel;
    }
  });

  // Aviso en reservas
  const aviso = document.getElementById("avisoLocal");
  if (aviso) {
    if (info.nota) {
      aviso.style.display = "block";
      aviso.textContent = "Aviso del local: " + info.nota;
    } else {
      aviso.style.display = "none";
    }
  }

  // Enlaces WhatsApp
  const digits = tel.replace(/\D/g, "");
  if (digits) {
    document.querySelectorAll('a[href*="wa.me"]').forEach((a) => {
      try {
        const u = new URL(a.getAttribute("href"), "https://wa.me");
        const text = u.searchParams.get("text");
        a.setAttribute("href", text
          ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
          : `https://wa.me/${digits}`);
      } catch (e) {
        a.setAttribute("href", `https://wa.me/${digits}`);
      }
    });
  }
}

function fechaPermitida(fechaStr) {
  if (!configNegocio.abierto) {
    return { ok: false, msg: "El local está cerrado. No se aceptan reservas ahora." };
  }
  const d = new Date(fechaStr + "T00:00:00");
  const dia = String(d.getDay()); // 0 dom
  if (!(configNegocio.dias_habiles || []).includes(dia)) {
    return { ok: false, msg: "Ese día de la semana no está habilitado para reservas." };
  }
  const feriados = configNegocio.feriados || [];
  if (feriados.includes(fechaStr)) {
    return { ok: false, msg: "Ese día es feriado o está bloqueado por el local." };
  }
  return { ok: true };
}



// ---------- TOAST ----------
function crearContenedorToast() {
  let c = document.querySelector(".toast-container");
  if (!c) {
    c = document.createElement("div");
    c.className = "toast-container";
    document.body.appendChild(c);
  }
  return c;
}

function mostrarToast(mensaje, tipo = "info") {
  const cont = crearContenedorToast();
  const t = document.createElement("div");
  t.className = "toast " + tipo;
  t.textContent = mensaje;
  cont.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity 0.4s";
    setTimeout(() => t.remove(), 400);
  }, 3800);
}

// ---------- MENÚ MÓVIL ----------
function iniciarMenuMovil() {
  const boton = document.getElementById("menuToggle");
  const menu = document.querySelector(".nav-links");
  if (!boton || !menu) return;
  boton.addEventListener("click", () => menu.classList.toggle("abierto"));
  menu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => menu.classList.remove("abierto"));
  });
}

// ---------- TRACKER ----------
function iniciarTracker() {
  const ids = ["s1", "s2", "s3", "s4"];
  if (!document.getElementById("s1")) return;
  const originales = ids.map((id) => document.getElementById(id).querySelector(".step-dot").innerHTML);
  let paso = 1;
  setInterval(() => {
    paso = (paso + 1) % 4;
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      el.querySelector(".step-dot").innerHTML = originales[i];
      if (i < paso) el.className = "step done";
      else if (i === paso) el.className = "step active";
      else el.className = "step idle";
    });
  }, 2200);
}

// ---------- AUTH MODAL ----------
function crearModalAuth() {
  if (document.getElementById("authOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "authOverlay";
  overlay.className = "auth-overlay";
  overlay.innerHTML = `
    <div class="auth-modal">
      <button class="auth-close" id="authClose" type="button" aria-label="Cerrar">×</button>
      <div class="auth-tabs">
        <button type="button" class="auth-tab active" data-tab="login">Iniciar sesión</button>
        <button type="button" class="auth-tab" data-tab="register">Registrarse</button>
      </div>
      <form id="formLogin">
        <h2>Iniciar sesión</h2>
        <p class="auth-sub">Entrá con tu correo y contraseña</p>
        <div class="form-group"><label>Correo</label><input type="email" id="loginEmail" required placeholder="tucorreo@email.com" /></div>
        <div class="form-group"><label>Contraseña</label><input type="password" id="loginPass" required minlength="6" placeholder="••••••••" /></div>
        <button type="submit" class="form-submit">Entrar</button>
      </form>
      <form id="formRegister" style="display:none;">
        <h2>Crear cuenta</h2>
        <p class="auth-sub">Registráte con cualquier correo</p>
        <div class="form-group"><label>Nombre</label><input type="text" id="regNombre" required placeholder="Tu nombre" /></div>
        <div class="form-group"><label>Correo</label><input type="email" id="regEmail" required placeholder="tucorreo@email.com" /></div>
        <div class="form-group"><label>Contraseña (mín. 6)</label><input type="password" id="regPass" required minlength="6" placeholder="••••••••" /></div>
        <button type="submit" class="form-submit">Registrarme</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("authClose").onclick = cerrarModalAuth;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrarModalAuth(); });
  // Evita que clics dentro del modal se comporten mal
  overlay.querySelector(".auth-modal").addEventListener("click", (e) => e.stopPropagation());

  overlay.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      overlay.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const login = tab.dataset.tab === "login";
      document.getElementById("formLogin").style.display = login ? "block" : "none";
      document.getElementById("formRegister").style.display = login ? "none" : "block";
    });
  });

  document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!clienteListo()) { avisarSinSupabase(); return; }
    const email = document.getElementById("loginEmail").value.trim();
    const pass = document.getElementById("loginPass").value;
    if (!email || !pass) {
      mostrarToast("Completá correo y contraseña", "error");
      return;
    }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Entrando...";
    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password: pass });
      if (error) {
        console.error("login error:", error);
        let msg = error.message || "Error al iniciar sesión";
        if (/confirm|not confirmed|email not confirmed/i.test(msg)) {
          msg = "Tu correo aún no está confirmado. En Supabase: Authentication → Providers → Email → desactivá Confirm email. O en Users confirmá el usuario a mano.";
        } else if (/invalid login|invalid credentials/i.test(msg)) {
          msg = "Correo o contraseña incorrectos. Revisá que sea la misma cuenta con la que te registraste.";
        }
        throw new Error(msg);
      }
      mostrarToast("¡Bienvenido!", "success");
      cerrarModalAuth();
      _adminLoginPedido = false;
      _cargandoSesion = false;
      _adminPanelListo = false;
      await cargarSesion({ event: "SIGNED_IN" });
    } catch (err) {
      mostrarToast(err.message || "Error al iniciar sesión", "error");
    }
    btn.disabled = false;
    btn.textContent = "Entrar";
  });

  document.getElementById("formRegister").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!clienteListo()) { avisarSinSupabase(); return; }
    const nombre = document.getElementById("regNombre").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const pass = document.getElementById("regPass").value;
    if (!nombre || !email || !pass) {
      mostrarToast("Completá nombre, correo y contraseña", "error");
      return;
    }
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Registrando...";
    try {
      if (!clienteListo()) {
        avisarSinSupabase();
        btn.disabled = false;
        btn.textContent = "Registrarme";
        return;
      }
      const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password: pass,
        options: { data: { nombre } }
      });
      if (error) {
        console.error("signUp error:", error);
        throw error;
      }
      console.info("signUp ok:", data);
      if (data && data.user && !data.session) {
        // Intento de entrar al toque (sirve si Confirm email está desactivado)
        const { error: e2 } = await window.supabaseClient.auth.signInWithPassword({ email, password: pass });
        if (e2) {
          mostrarToast("Cuenta creada, pero hay que confirmar el correo o desactivar Confirm email en Supabase para poder entrar.", "error");
        } else {
          mostrarToast("Cuenta creada. Ya podés reservar.", "success");
        }
      } else {
        mostrarToast("Cuenta creada. Ya podés reservar.", "success");
      }
      cerrarModalAuth();
      await cargarSesion();
    } catch (err) {
      console.error(err);
      const msg = (err && (err.message || err.error_description || err.msg)) || "Error al registrarse";
      mostrarToast(msg, "error");
    }
    btn.disabled = false;
    btn.textContent = "Registrarme";
  });
}

function pintarEstadoSupabase() {
  const overlay = document.getElementById("authOverlay");
  if (!overlay) return;
  let st = document.getElementById("supabaseStatus");
  if (!st) {
    st = document.createElement("p");
    st.id = "supabaseStatus";
    st.style.cssText = "font-size:0.78rem;margin:0 0 0.8rem;padding:8px 10px;border-radius:8px;line-height:1.4;";
    const modal = overlay.querySelector(".auth-modal");
    const tabs = modal && modal.querySelector(".auth-tabs");
    if (tabs) modal.insertBefore(st, tabs.nextSibling);
    else if (modal) modal.insertBefore(st, modal.firstChild);
  }
  if (clienteListo()) {
    st.style.background = "#EAF3DE";
    st.style.color = "#3B6D11";
    st.textContent = "Conectado a Supabase — podés registrarte";
  } else {
    st.style.background = "#FCE8E8";
    st.style.color = "#A31B1B";
    st.textContent = "NO conectado. Motivo: " + (window.__servitecSupabaseMsg || "desconocido");
  }
}

function abrirModalAuth(tab) {
  crearModalAuth();
  const overlay = document.getElementById("authOverlay");
  overlay.classList.add("visible");
  pintarEstadoSupabase();

  // Reintentar carga de librería + cliente
  if (typeof window.asegurarSupabase === "function") {
    window.asegurarSupabase(function (ok) {
      pintarEstadoSupabase();
      if (!ok) {
        mostrarToast("Sin Supabase: " + (window.__servitecSupabaseMsg || "revisá las keys"), "error");
      }
    });
  } else if (typeof crearClienteSupabase === "function") {
    crearClienteSupabase();
    pintarEstadoSupabase();
  }
  const isReg = tab === "register";
  overlay.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === (isReg ? "register" : "login")));
  document.getElementById("formLogin").style.display = isReg ? "none" : "block";
  document.getElementById("formRegister").style.display = isReg ? "block" : "none";
}

function cerrarModalAuth() {
  const o = document.getElementById("authOverlay");
  if (o) o.classList.remove("visible");
}

let _adminLoginPedido = false;
let _cargandoSesion = false;
let _adminPanelListo = false;

function esRolAdmin(perfil) {
  const r = String((perfil && perfil.role) || "").trim().toLowerCase();
  return r === "admin";
}

function recordarAdminLocal(si) {
  try {
    if (si) sessionStorage.setItem("servitec_is_admin", "1");
    else sessionStorage.removeItem("servitec_is_admin");
  } catch (e) {}
}

function eraAdminLocal() {
  try { return sessionStorage.getItem("servitec_is_admin") === "1"; } catch (e) { return false; }
}

async function cargarPerfil(userId) {
  if (!userId || !clienteListo()) return null;
  try {
    let { data, error } = await window.supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) console.warn("profiles:", error);
    if (!data) {
      await new Promise((r) => setTimeout(r, 600));
      const r2 = await window.supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      data = r2.data;
    }
    return data || null;
  } catch (e) {
    console.warn("cargarPerfil:", e);
    return null;
  }
}

async function cargarSesion(opts = {}) {
  const fromAuth = !!(opts && opts.fromAuth);
  const event = (opts && opts.event) || "";

  // Refresh de token: NUNCA cerrar sesión ni tocar la UI de reservas
  if (event === "TOKEN_REFRESHED") {
    try {
      if (clienteListo()) {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session && session.user) {
          usuarioActual = session.user;
        }
        // no tocamos perfil ni UI: evita que "se caiga" el login al reservar
      }
    } catch (e) {}
    return;
  }

  if (_cargandoSesion) return;
  _cargandoSesion = true;

  try {
    if (!clienteListo()) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!clienteListo()) {
      // Solo pedir login si nunca hubo panel admin en esta pestaña
      if (document.body.dataset.page === "admin" && !_adminPanelListo && !_adminLoginPedido) {
        _adminLoginPedido = true;
        mostrarToast("No hay conexión con Supabase. Revisá la anon key.", "error");
        abrirModalAuth("login");
      }
      return;
    }

    const { data: { session }, error: sesErr } = await window.supabaseClient.auth.getSession();
    if (sesErr) console.warn("getSession:", sesErr);

    const prevUser = usuarioActual;
    if (session && session.user) {
      usuarioActual = session.user;
    } else if (event === "SIGNED_OUT") {
      usuarioActual = null;
    } else if (prevUser) {
      // Mantener sesión previa si getSession falló un instante (no cerrar al reservar)
      usuarioActual = prevUser;
      console.warn("[ServiTec] getSession vacío momentáneo; se mantiene la sesión");
    } else {
      usuarioActual = null;
    }

    if (usuarioActual) {
      const perfil = await cargarPerfil(usuarioActual.id);
      if (perfil) {
        perfilActual = perfil;
      } else if (prevUser && prevUser.id === usuarioActual.id && perfilActual) {
        // Mantener perfil anterior si el fetch falló un momento
      }
      // si no hay perfil, no lo borramos a null si ya teníamos uno
    } else if (event === "SIGNED_OUT") {
      perfilActual = null;
      recordarAdminLocal(false);
      _adminPanelListo = false;
    }

    actualizarUIAuth();
    actualizarVistaReservas();

    if (document.body.dataset.page === "admin") {
      await gateAdmin(event);
    }
  } catch (e) {
    console.error("Sesión:", e);
  } finally {
    _cargandoSesion = false;
  }
}

async function gateAdmin(event) {
  if (document.body.dataset.page !== "admin") return;

  const adminOk = usuarioActual && (esRolAdmin(perfilActual) || eraAdminLocal());

  if (adminOk) {
    if (esRolAdmin(perfilActual)) recordarAdminLocal(true);
    _adminLoginPedido = false;
    _adminPanelListo = true;
    try { cerrarModalAuth(); } catch (e) {}
    // Solo recargar panel la primera vez o si viene de login
    if (!_adminPanelListo || event === "SIGNED_IN" || event === "" || event === "INITIAL") {
      await cargarPanelAdmin();
    } else {
      await cargarPanelAdmin();
    }
    return;
  }

  // Logueado pero NO admin
  if (usuarioActual && !esRolAdmin(perfilActual) && !eraAdminLocal()) {
    recordarAdminLocal(false);
    _adminPanelListo = false;
    const rol = (perfilActual && perfilActual.role) ? perfilActual.role : "(sin perfil)";
    mostrarToast(
      "Esta cuenta no es administrador (rol: " + rol + "). En Supabase → profiles → role = admin",
      "error"
    );
    // Redirigir una sola vez, sin bucle de modal
    if (event !== "TOKEN_REFRESHED") {
      setTimeout(() => {
        if (document.body.dataset.page === "admin" && !esRolAdmin(perfilActual) && !eraAdminLocal()) {
          window.location.href = "index.html";
        }
      }, 2000);
    }
    return;
  }

  // Sin sesión: pedir login solo una vez
  if (!usuarioActual && !_adminPanelListo) {
    if (event === "TOKEN_REFRESHED") return; // no molestar en refresh
    if (!_adminLoginPedido) {
      _adminLoginPedido = true;
      mostrarToast("Iniciá sesión con la cuenta administradora", "info");
      abrirModalAuth("login");
    }
  }
}

function actualizarUIAuth() {
  let zona = document.getElementById("navAuthZone");
  if (!zona) {
    const nav = document.querySelector("nav");
    if (!nav) return;
    zona = document.createElement("div");
    zona.id = "navAuthZone";
    const cta = nav.querySelector(".nav-cta");
    if (cta) nav.insertBefore(zona, cta);
    else nav.appendChild(zona);
  }
  if (usuarioActual) {
    const nombre = perfilActual?.nombre || usuarioActual.email?.split("@")[0] || "Usuario";
    const esAdmin = typeof esRolAdmin === 'function' ? esRolAdmin(perfilActual) : (perfilActual && perfilActual.role === 'admin');
    zona.innerHTML = `
      <div class="nav-user">
        <span>Hola, <strong>${nombre}</strong></span>
        ${esAdmin ? '<a href="admin.html" style="color:#F5A623;font-size:0.75rem;text-decoration:none;">Admin</a>' : ""}
        <button type="button" class="btn-logout" id="btnLogout">Salir</button>
      </div>`;
    document.getElementById("btnLogout").onclick = cerrarSesion;
  } else {
    zona.innerHTML = `<button type="button" class="btn-login-nav" id="btnOpenLogin">Iniciar sesión</button>`;
    document.getElementById("btnOpenLogin").onclick = () => abrirModalAuth("login");
  }
}

async function cerrarSesion() {
  try { await window.supabaseClient.auth.signOut(); } catch (e) {}
  usuarioActual = null;
  perfilActual = null;
  mostrarToast("Sesión cerrada", "info");
  actualizarUIAuth();
  actualizarVistaReservas();
  if (document.body.dataset.page === "admin") window.location.href = "index.html";
}

// ---------- RESERVAS UI ----------
function actualizarVistaReservas() {
  const form = document.getElementById("form-reserva");
  const formWrap = document.getElementById("formWrap");
  const box = document.getElementById("authRequiredBox");
  const exito = document.getElementById("reservaExito");
  if (!form && !box) return;

  // Si ya está en pantalla de pago/éxito, no volver a pedir login ni resetear
  const enPago = exito && exito.style.display !== "none" && window.getComputedStyle(exito).display !== "none";

  if (usuarioActual) {
    if (box) box.style.display = "none";
    if (enPago) {
      cargarMisReservas();
      return;
    }
    if (formWrap) formWrap.style.display = "block";
    if (form) form.style.display = "block";
    const n = document.getElementById("nombre");
    const em = document.getElementById("correo");
    if (n && perfilActual && perfilActual.nombre && !n.value) n.value = perfilActual.nombre;
    if (em && usuarioActual.email && !em.value) em.value = usuarioActual.email;
    cargarMisReservas();
  } else {
    // Solo mostrar "iniciar sesión" si no hay usuario real
    if (enPago) return;
    if (box) box.style.display = "block";
    if (formWrap) formWrap.style.display = "none";
    if (form) form.style.display = "none";
  }
}

// ---------- SERVICIOS (select + cards públicas) ----------

function deduplicarServicios(lista) {
  if (!lista || !lista.length) return [];
  const vistos = new Map();
  // Nos quedamos con el de id más bajo por nombre (el original)
  [...lista].sort((a, b) => Number(a.id) - Number(b.id)).forEach((s) => {
    const key = String(s.nombre || "").trim().toLowerCase();
    if (!key) return;
    if (!vistos.has(key)) vistos.set(key, s);
  });
  return Array.from(vistos.values()).sort((a, b) => Number(a.id) - Number(b.id));
}

async function cargarServicios() {
  // Esperar cliente Supabase (hasta 3 intentos)
  for (let i = 0; i < 6 && !clienteListo(); i++) {
    await new Promise((r) => setTimeout(r, 300));
  }

  let data = null;
  if (clienteListo()) {
    try {
      const res = await window.supabaseClient
        .from("servicios")
        .select("id, nombre, descripcion, precio_desde, activo")
        .order("id");
      if (res.error) console.warn("servicios:", res.error);
      data = deduplicarServicios((res.data || []).filter((s) => s.activo !== false));
    } catch (e) {
      console.error(e);
    }
    // Respaldo: precios_json en configuracion
    if (!data || !data.length) {
      try {
        const { data: cfg } = await window.supabaseClient
          .from("configuracion")
          .select("valor")
          .eq("clave", "precios_json")
          .maybeSingle();
        if (cfg && cfg.valor) {
          data = deduplicarServicios(JSON.parse(cfg.valor));
        }
      } catch (e) {}
    }
    if (data && data.length) {
      try { localStorage.setItem("servitec_precios", JSON.stringify(data)); } catch (e) {}
    }
  }

  // Fallback: cache local si Supabase no respondió
  if ((!data || !data.length)) {
    try {
      const cached = JSON.parse(localStorage.getItem("servitec_precios") || "[]");
      if (cached && cached.length) data = deduplicarServicios(cached);
    } catch (e) {}
  }

  aplicarPreciosEnPantalla(data);

  const select = document.getElementById("servicio");
  if (select && data && data.length) {
    select.innerHTML = '<option value="">— Seleccioná —</option>';
    data.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nombre + " (desde Bs. " + s.precio_desde + ")";
      opt.dataset.nombre = s.nombre;
      opt.dataset.precio = s.precio_desde;
      select.appendChild(opt);
    });
    select.onchange = () => {
      const opt = select.options[select.selectedIndex];
      const box = document.getElementById("precioBox");
      const label = document.getElementById("precioEstimado");
      if (!box || !label) return;
      if (opt && opt.dataset.precio) {
        box.style.display = "block";
        label.textContent = "Bs. " + opt.dataset.precio;
      } else box.style.display = "none";
    };
  }

  // Aviso del local (nota del admin) en reservas
  try {
    const info = JSON.parse(localStorage.getItem("servitec_admin_info") || "{}");
    let aviso = document.getElementById("avisoLocal");
    if (!aviso) {
      const header = document.querySelector(".page-header");
      if (header && info.nota) {
        aviso = document.createElement("div");
        aviso.id = "avisoLocal";
        aviso.style.cssText = "max-width:560px;margin:0 auto 1rem;padding:0.8rem 1rem;background:#FFF6E5;border-radius:10px;color:#8A5A00;font-size:0.88rem;";
        header.insertAdjacentElement("afterend", aviso);
      }
    }
    if (aviso) {
      if (info.nota) {
        aviso.style.display = "block";
        aviso.textContent = "Aviso del local: " + info.nota;
      } else {
        aviso.style.display = "none";
      }
    }
  } catch (e) {}
}

function aplicarPreciosEnPantalla(data) {
  if (!data || !data.length) {
    console.warn("[ServiTec] sin datos de precios para pintar");
    return;
  }
  data.forEach((s) => {
    const nombre = String(s.nombre || "").trim().toLowerCase();
    const precio = s.precio_desde;
    if (precio === undefined || precio === null || nombre === "") return;
    document.querySelectorAll("[data-servicio-nombre]").forEach((el) => {
      const n = String(el.getAttribute("data-servicio-nombre") || "").trim().toLowerCase();
      // coincidencia exacta o si uno contiene al otro
      if (n === nombre || n.includes(nombre) || nombre.includes(n)) {
        el.textContent = "Desde Bs. " + precio;
        el.setAttribute("data-precio-ok", "1");
      }
    });
    document.querySelectorAll("[data-servicio-desc]").forEach((el) => {
      const n = String(el.getAttribute("data-servicio-desc") || "").trim().toLowerCase();
      if ((n === nombre || n.includes(nombre) || nombre.includes(n)) && s.descripcion) {
        el.textContent = s.descripcion;
      }
    });
  });
  console.info("[ServiTec] precios aplicados:", data.map((x) => x.nombre + "=" + x.precio_desde).join(", "));
}

async function enviarReserva(e) {
  e.preventDefault();
  if (!usuarioActual) {
    mostrarToast("Tenés que iniciar sesión para reservar", "error");
    abrirModalAuth("login");
    return;
  }
  if (!clienteListo()) { avisarSinSupabase(); return; }
  await cargarConfigNegocio();

  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("tel").value.trim();
  const email = document.getElementById("correo").value.trim();
  const select = document.getElementById("servicio");
  const servicioId = select.value;
  const servicioNombre = select.options[select.selectedIndex]?.dataset?.nombre || "";
  const fecha = document.getElementById("fecha").value;
  const horario = document.getElementById("horario").value;
  const desc = document.getElementById("desc").value.trim();

  if (!nombre || !/^[A-Za-zÁÉÍÓÚáéíóúÑñ ]{2,}$/.test(nombre)) {
    mostrarToast("El nombre solo puede tener letras (sin números)", "error"); return;
  }
  if (!telefono || !/^[0-9+ ]{7,15}$/.test(telefono)) {
    mostrarToast("El teléfono solo puede tener números", "error"); return;
  }
  if (!servicioId) { mostrarToast("Seleccioná el tipo de servicio", "error"); return; }
  if (!fecha || !horario) { mostrarToast("Seleccioná fecha y horario", "error"); return; }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fechaElegida = new Date(fecha + "T00:00:00");
  if (fechaElegida < hoy) { mostrarToast("No se puede reservar en fechas pasadas", "error"); return; }
  if (fechaElegida.getTime() === hoy.getTime()) {
    const horaInicio = parseInt(horario.split(":")[0], 10);
    if (!isNaN(horaInicio) && horaInicio <= new Date().getHours()) {
      mostrarToast("Ese horario de hoy ya pasó. Elegí otro.", "error"); return;
    }
  }

  const perm = fechaPermitida(fecha);
  if (!perm.ok) { mostrarToast(perm.msg, "error"); return; }

  try {
    const { data: ocupadas } = await window.supabaseClient
      .from("reservas").select("id")
      .eq("fecha", fecha).eq("horario", horario)
      .in("estado", ["esperando_pago", "pago_reportado", "pendiente", "confirmada", "completada"]);
    if (ocupadas && ocupadas.length > 0) {
      mostrarToast("Ese horario de ese día YA ESTÁ OCUPADO. Elegí otra hora u otro día.", "error");
      return;
    }
  } catch (err) { console.error(err); }

  const btn = document.getElementById("btn-reservar");
  if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }

  // SE GUARDA YA en la base con estado esperando_pago (el admin la ve)
  try {
    const fila = {
      usuario_id: usuarioActual.id,
      nombre_cliente: nombre,
      telefono,
      email: email || usuarioActual.email,
      servicio_id: parseInt(servicioId),
      servicio_nombre: servicioNombre,
      fecha,
      horario,
      descripcion_problema: desc || null,
      costo_reserva: 10,
      estado: "esperando_pago",
      visto_cliente: false
    };
    const { data, error } = await window.supabaseClient
      .from("reservas")
      .insert([fila])
      .select("id")
      .single();
    if (error) throw error;

    reservaPendientePago = { id: data.id, ...fila };

    const formWrap = document.getElementById("formWrap");
    const exito = document.getElementById("reservaExito");
    if (formWrap) formWrap.style.display = "none";
    if (exito) {
      exito.style.display = "block";
      const resumen = document.getElementById("exitoResumen");
      if (resumen) resumen.textContent = `${nombre} · ${servicioNombre} · ${fecha} · ${horario} · Bs. 10 (esperando pago)`;
      const box = document.getElementById("pagoBox");
      if (box) {
        box.innerHTML = htmlPanelPago();
        const wa = document.getElementById("btnWhatsAppPago");
        if (wa) {
          wa.href = "https://wa.me/59178118558?text=" + encodeURIComponent(
            `Hola ServiTec, reservé y voy a pagar Bs. 10:\nNombre: ${nombre}\nServicio: ${servicioNombre}\nFecha: ${fecha} ${horario}\nNº reserva: ${data.id}`
          );
        }
        cablearPanelPago();
      }
    }
    mostrarToast("Reserva registrada. Ahora pagá y subí la foto del comprobante.", "success");
    await cargarMisReservas();
  } catch (err) {
    console.error(err);
    mostrarToast("No se pudo guardar la reserva: " + (err.message || "error"), "error");
  }
  if (btn) { btn.disabled = false; btn.textContent = "Confirmar reserva (Bs. 10)"; }
}

function leerArchivoComoDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Sin archivo"));
    if (!file.type.startsWith("image/")) return reject(new Error("Solo se permiten imágenes"));
    if (file.size > 2.5 * 1024 * 1024) return reject(new Error("La imagen debe pesar menos de 2,5 MB"));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

async function enviarComprobantePago() {
  if (!reservaPendientePago || !reservaPendientePago.id) {
    mostrarToast("No hay una reserva pendiente. Completá el formulario primero.", "error");
    return;
  }
  if (!clienteListo()) { avisarSinSupabase(); return; }

  const inputFoto = document.getElementById("fotoComprobante");
  const file = inputFoto && inputFoto.files && inputFoto.files[0];
  if (!file) {
    mostrarToast("Debés subir la FOTO del comprobante de pago. Es obligatorio.", "error");
    if (inputFoto) inputFoto.focus();
    return;
  }

  const nota = document.getElementById("notaComprobante")?.value.trim() || "Cliente envió foto del comprobante";
  const btn = document.getElementById("btnYaPague");
  if (btn) { btn.disabled = true; btn.textContent = "Subiendo foto..."; }

  try {
    const dataUrl = await leerArchivoComoDataURL(file);
    const { error } = await window.supabaseClient
      .from("reservas")
      .update({
        estado: "pago_reportado",
        pago_reportado_at: new Date().toISOString(),
        comprobante_nota: nota,
        comprobante_imagen: dataUrl,
        visto_cliente: false
      })
      .eq("id", reservaPendientePago.id);
    if (error) throw error;

    mostrarToast("Comprobante con foto enviado. El local lo revisará.", "success");
    reservaPendientePago = null;
    const box = document.getElementById("pagoBox");
    if (box) {
      box.innerHTML = `<p style="color:#3B6D11;font-weight:600;">Foto del comprobante enviada correctamente.</p>
        <p style="font-size:0.88rem;color:var(--acero);">El administrador revisará el pago. Cuando confirme, verás tu reserva como <strong>confirmada</strong>.</p>`;
    }
    await cargarMisReservas();
  } catch (err) {
    console.error(err);
    mostrarToast(err.message || "No se pudo enviar el comprobante", "error");
  }
  if (btn) { btn.disabled = false; btn.textContent = "Ya pagué — enviar comprobante con foto"; }
}

async function cargarMisReservas() {
  const box = document.getElementById("misReservasBox");
  const aviso = document.getElementById("avisoConfirmacion");
  if (!box || !usuarioActual || !clienteListo()) return;
  try {
    const { data } = await window.supabaseClient.from("reservas").select("*")
      .eq("usuario_id", usuarioActual.id).order("created_at", { ascending: false }).limit(10);
    if (!data || !data.length) {
      box.style.display = "none";
      if (aviso) aviso.style.display = "none";
      return;
    }
    const nuevas = data.filter((r) => r.estado === "confirmada" && r.visto_cliente === false);
    if (aviso) {
      if (nuevas.length) {
        aviso.style.display = "block";
        aviso.innerHTML = "Tu reserva fue <strong>CONFIRMADA</strong>: " +
          nuevas.map((r) => `${r.fecha} ${r.horario} (${r.servicio_nombre})`).join(" · ");
        for (const r of nuevas) {
          await window.supabaseClient.from("reservas").update({ visto_cliente: true }).eq("id", r.id);
        }
      } else aviso.style.display = "none";
    }
    const etiqueta = {
      esperando_pago: "esperando que subas el pago",
      pago_reportado: "comprobante en revisión",
      pendiente: "pendiente",
      confirmada: "confirmada",
      completada: "completada",
      cancelada: "cancelada"
    };
    box.style.display = "block";
    box.innerHTML = `<div style="background:#fff;border:1px solid #D8E2F0;border-radius:12px;padding:1rem;">
      <strong style="display:block;margin-bottom:0.6rem;">Mis reservas</strong>
      ${data.map((r) => `<div style="font-size:0.85rem;padding:0.55rem 0;border-top:1px solid #EDF2FA;">
        <div>${r.fecha} ${r.horario} — ${r.servicio_nombre || ""}
        <span class="estado-badge estado-${r.estado === "pago_reportado" || r.estado === "esperando_pago" ? "pendiente" : r.estado}" style="margin-left:6px;">${
          etiqueta[r.estado] || r.estado
        }</span></div>
        ${r.estado === "esperando_pago" ? `<button type="button" class="btn-primary" data-pagar-id="${r.id}" style="margin-top:0.45rem;padding:8px 14px;font-size:0.8rem;">Pagar ahora / subir comprobante</button>` : ""}
      </div>`).join("")}
    </div>`;
    box.querySelectorAll("[data-pagar-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-pagar-id"), 10);
        const row = data.find((x) => x.id === id);
        if (row) reabrirPanelPago(row);
      });
    });
  } catch (e) { console.error(e); }
}

function htmlPanelPago() {
  return `
        <div class="pago-titulo">Costo de la reserva</div>
        <div class="pago-monto">Bs. 10</div>
        <p style="font-size:0.85rem;color:var(--acero);margin:0.5rem 0 0.8rem;">
          1) Pagá <strong>Bs. 10</strong> con el QR.<br/>
          2) Subí la <strong>foto del comprobante</strong> (obligatorio).<br/>
          3) Tocá enviar.
        </p>
        <img src="img/qr-pago.jpeg" alt="QR de pago Altóke" style="width:min(240px,100%);border-radius:12px;border:1px solid #D8E2F0;margin:0.5rem auto;display:block;" />
        <p style="font-size:0.75rem;color:var(--acero);margin:0.5rem 0 1rem;">CTA: 3246940-000-001</p>
        <div class="form-group" style="text-align:left;margin-bottom:0.8rem;">
          <label for="fotoComprobante">Foto del comprobante de pago <span style="color:#A31B1B;">*</span></label>
          <input type="file" id="fotoComprobante" accept="image/*" capture="environment" />
          <p style="font-size:0.75rem;color:var(--acero);margin-top:0.35rem;">Obligatorio: captura o foto del pago.</p>
          <div id="previewComprobante" style="display:none;margin-top:0.6rem;">
            <img id="previewComprobanteImg" alt="Vista previa" style="max-width:100%;max-height:180px;border-radius:8px;border:1px solid #D8E2F0;" />
          </div>
        </div>
        <div class="form-group" style="text-align:left;margin-bottom:0.8rem;">
          <label for="notaComprobante">Nota (opcional)</label>
          <input type="text" id="notaComprobante" placeholder="Ej: pagué por Altóke a las 15:30" />
        </div>
        <button type="button" class="btn-primary" id="btnYaPague" style="width:100%;margin-bottom:0.6rem;">
          Ya pagué — enviar comprobante con foto
        </button>
        <a id="btnWhatsAppPago" href="https://wa.me/59178118558" target="_blank" class="btn-primary" style="display:inline-block;text-decoration:none;background:#0B1F3A;">
          También avisar por WhatsApp
        </a>`;
}

function cablearPanelPago() {
  const btnYaPague = document.getElementById("btnYaPague");
  if (btnYaPague) btnYaPague.onclick = enviarComprobantePago;
  const fotoComp = document.getElementById("fotoComprobante");
  if (fotoComp) {
    fotoComp.onchange = () => {
      const f = fotoComp.files && fotoComp.files[0];
      const prev = document.getElementById("previewComprobante");
      const img = document.getElementById("previewComprobanteImg");
      if (f && img && prev) {
        img.src = URL.createObjectURL(f);
        prev.style.display = "block";
      }
    };
  }
}

function reabrirPanelPago(row) {
  reservaPendientePago = {
    id: row.id,
    usuario_id: row.usuario_id,
    nombre_cliente: row.nombre_cliente,
    telefono: row.telefono,
    email: row.email,
    servicio_id: row.servicio_id,
    servicio_nombre: row.servicio_nombre,
    fecha: row.fecha,
    horario: row.horario,
    descripcion_problema: row.descripcion_problema,
    costo_reserva: row.costo_reserva || 10
  };

  const formWrap = document.getElementById("formWrap");
  const authBox = document.getElementById("authRequiredBox") || document.querySelector(".auth-required-box:not(#reservaExito)");
  const exito = document.getElementById("reservaExito");
  if (formWrap) formWrap.style.display = "none";
  // hide login prompt if visible
  document.querySelectorAll(".auth-required-box").forEach((el) => {
    if (el.id !== "reservaExito") el.style.display = "none";
  });
  if (exito) {
    exito.style.display = "block";
    const resumen = document.getElementById("exitoResumen");
    if (resumen) {
      resumen.textContent = `${row.nombre_cliente} · ${row.servicio_nombre || ""} · ${row.fecha} ${row.horario} · Bs. 10 — completá el pago`;
    }
    const box = document.getElementById("pagoBox");
    if (box) {
      box.innerHTML = htmlPanelPago();
      const wa = document.getElementById("btnWhatsAppPago");
      if (wa) {
        wa.href = "https://wa.me/59178118558?text=" + encodeURIComponent(
          `Hola ServiTec, voy a pagar mi reserva Nº ${row.id}:
${row.nombre_cliente}
${row.servicio_nombre}
${row.fecha} ${row.horario}`
        );
      }
      cablearPanelPago();
    }
    exito.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  mostrarToast("Completá el pago y subí la foto del comprobante", "info");
}



// ---------- ADMIN ----------
function iniciarMenuAdmin() {
  function mostrarSeccion(sec) {
    document.querySelectorAll(".admin-menu-btn").forEach((b) => b.classList.toggle("active", b.dataset.section === sec));
    document.querySelectorAll(".admin-section-panel").forEach((p) => (p.style.display = "none"));
    const panel = document.getElementById("sec-" + sec);
    if (panel) panel.style.display = "block";
  }
  document.querySelectorAll(".admin-menu-btn").forEach((btn) => {
    btn.addEventListener("click", () => mostrarSeccion(btn.dataset.section));
  });
  document.querySelectorAll("[data-go-section]").forEach((btn) => {
    btn.addEventListener("click", () => mostrarSeccion(btn.getAttribute("data-go-section")));
  });
}

async function cargarPanelAdmin() {
  // Servicios / precios
  const tbodyServ = document.getElementById("adminServiciosBody");
  try {
    const { data: servicios, error } = await window.supabaseClient.from("servicios").select("*").order("id");
    if (error) throw error;
    if (tbodyServ) {
      if (!servicios || !servicios.length) {
        tbodyServ.innerHTML = '<tr><td colspan="4">No hay servicios cargados en la base de datos.</td></tr>';
      } else {
        const unicos = deduplicarServicios(servicios);
        tbodyServ.innerHTML = unicos.map((s) => `
          <tr>
            <td>
              <strong>${s.nombre}</strong>
              <input type="text" value="${(s.descripcion || "").replace(/"/g, "&quot;")}" data-id="${s.id}" class="input-desc" style="display:block;width:100%;margin-top:4px;font-size:0.78rem;" placeholder="Texto / descripción" />
            </td>
            <td><input type="number" step="0.01" value="${s.precio_desde}" data-id="${s.id}" class="input-precio" /></td>
            <td>${s.activo ? "Sí" : "No"}</td>
            <td><button type="button" class="btn-sm save" data-guardar-precio="${s.id}">Guardar</button></td>
          </tr>`).join("");
        tbodyServ.querySelectorAll("[data-guardar-precio]").forEach((btn) => {
          btn.addEventListener("click", () => guardarPrecio(btn.getAttribute("data-guardar-precio")));
        });
      }
      const st = document.getElementById("statServicios");
      if (st) st.textContent = deduplicarServicios(servicios || []).filter((s) => s.activo !== false).length;
    }
  } catch (e) {
    console.error(e);
    if (tbodyServ) tbodyServ.innerHTML = '<tr><td colspan="4">No se pudieron cargar los servicios. Revisá Supabase.</td></tr>';
  }

  // Reservas
  const tbodyRes = document.getElementById("adminReservasBody");
  try {
    const { data: reservas, error } = await window.supabaseClient
      .from("reservas").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    if (tbodyRes) {
      // Solo reservas ya aceptadas / en agenda (después de confirmar el comprobante)
      const reservasAgenda = (reservas || [])
        .filter((r) => ["confirmada", "pendiente", "completada", "cancelada"].includes(String(r.estado || "")))
        .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
      if (!reservasAgenda.length) {
        tbodyRes.innerHTML = '<tr><td colspan="6" style="color:var(--acero);">Vacío. Cuando confirmés un comprobante (pestaña anterior), la reserva entra aquí como CONFIRMADA. Luego podés marcarla COMPLETADA cuando ya atendiste.</td></tr>';
      } else {
        tbodyRes.innerHTML = reservasAgenda.map((r) => `
          <tr>
            <td><strong>${r.nombre_cliente}</strong><br><small>${r.telefono || ""}</small><br><small>${r.email || ""}</small></td>
            <td>${r.servicio_nombre || "-"}</td>
            <td>${r.fecha}<br><small>${r.horario || ""}</small></td>
            <td><small>${(r.descripcion_problema || "-").substring(0, 60)}</small></td>
            <td><span class="estado-badge estado-${r.estado}">${
              r.estado === "confirmada" ? "confirmada (por atender)" :
              r.estado === "completada" ? "completada (ya atendida)" :
              r.estado
            }</span></td>
            <td>
              <select data-estado-id="${r.id}" style="font-size:0.75rem;padding:3px;">
                <option value="confirmada" ${r.estado === "confirmada" ? "selected" : ""}>confirmada (por atender)</option>
                <option value="completada" ${r.estado === "completada" ? "selected" : ""}>completada (ya atendida)</option>
                <option value="cancelada" ${r.estado === "cancelada" ? "selected" : ""}>cancelada</option>
              </select>
            </td>
          </tr>`).join("");
        tbodyRes.querySelectorAll("[data-estado-id]").forEach((sel) => {
          sel.addEventListener("change", () => cambiarEstadoReserva(sel.getAttribute("data-estado-id"), sel.value));
        });
      }
      const hoyStr = new Date().toISOString().slice(0, 10);
      const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
      set("statPendientes", (reservas || []).filter((r) => r.estado === "pago_reportado").length);
      set("statHoy", (reservasAgenda || []).filter((r) => r.fecha === hoyStr).length);
      set("statTotal", (reservasAgenda || []).length);
    }
  } catch (e) {
    console.error(e);
    if (tbodyRes) tbodyRes.innerHTML = '<tr><td colspan="6">No se pudieron cargar las reservas. Revisá la conexión con Supabase.</td></tr>';
    ["statPendientes", "statHoy", "statTotal"].forEach((id) => {
      const n = document.getElementById(id);
      if (n) n.textContent = "0";
    });
  }

  // Datos del local
  try {
    const info = JSON.parse(localStorage.getItem("servitec_admin_info") || "{}");
    if (info.horario && document.getElementById("adminHorario")) document.getElementById("adminHorario").value = info.horario;
    if (info.direccion && document.getElementById("adminDireccion")) document.getElementById("adminDireccion").value = info.direccion;
    if (info.telefono && document.getElementById("adminTelefono")) document.getElementById("adminTelefono").value = info.telefono;
    if (info.nota && document.getElementById("adminNota")) document.getElementById("adminNota").value = info.nota;
  } catch (e) {}

  const btnInfo = document.getElementById("btnGuardarInfo");
  if (btnInfo) {
    btnInfo.onclick = async () => {
      const info = {
        horario: document.getElementById("adminHorario")?.value || "",
        direccion: document.getElementById("adminDireccion")?.value || "",
        telefono: document.getElementById("adminTelefono")?.value || "",
        nota: document.getElementById("adminNota")?.value || ""
      };
      localStorage.setItem("servitec_admin_info", JSON.stringify(info));
      await guardarDatosLocalRemoto(info);
      aplicarDatosLocal();
      mostrarToast("Datos guardados. La nota se muestra a los clientes en Reservas.", "success");
    };
  }

  await cargarMovimientos();
  await cargarComprobantesAdmin();
  await cargarEsperandoPagoAdmin();
  await cargarUIDisponibilidadAdmin();


  const formMov = document.getElementById("formMovimiento");
  if (formMov) {
    formMov.onsubmit = async (ev) => {
      ev.preventDefault();
      const tipo = document.getElementById("movTipo").value;
      const concepto = document.getElementById("movConcepto").value.trim();
      const monto = parseFloat(document.getElementById("movMonto").value);
      const fecha = document.getElementById("movFecha").value || new Date().toISOString().slice(0, 10);
      const notas = document.getElementById("movNotas").value.trim();
      if (!tipo) { mostrarToast("Elegí si es ingreso o gasto", "error"); return; }
      if (!concepto) { mostrarToast("Escribí el concepto (ej: compra de LEDs)", "error"); return; }
      if (isNaN(monto) || monto <= 0) { mostrarToast("Ingresá un monto válido", "error"); return; }

      try {
        const { error } = await window.supabaseClient.from("movimientos").insert([{
          tipo, concepto, monto, fecha, notas: notas || null
        }]);
        if (error) throw error;
        mostrarToast("Movimiento guardado en la base de datos", "success");
        formMov.reset();
        await cargarMovimientos();
  await cargarComprobantesAdmin();
  await cargarEsperandoPagoAdmin();
  await cargarUIDisponibilidadAdmin();

      } catch (err) {
        console.error(err);
        mostrarToast("No se guardó. Ejecutá el schema.sql (tabla movimientos) en Supabase.", "error");
      }
    };
  }
}

async function cargarMovimientos() {
  const tbody = document.getElementById("adminMovimientosBody");
  if (!tbody) return;
  try {
    const { data, error } = await window.supabaseClient.from("movimientos").select("*").order("fecha", { ascending: false }).limit(100);
    if (error) throw error;
    let ing = 0, gas = 0;
    (data || []).forEach((m) => {
      if (m.tipo === "ingreso") ing += Number(m.monto);
      else gas += Number(m.monto);
    });
    const si = document.getElementById("sumIngresos");
    const sg = document.getElementById("sumGastos");
    const sb = document.getElementById("sumBalance");
    if (si) si.textContent = "Bs. " + ing.toFixed(2);
    if (sg) sg.textContent = "Bs. " + gas.toFixed(2);
    if (sb) sb.textContent = "Bs. " + (ing - gas).toFixed(2);

    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--acero);">Sin movimientos todavía. Registrá un gasto o ingreso arriba.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((m) => `
      <tr>
        <td><span class="estado-badge ${m.tipo === "ingreso" ? "estado-completada" : "estado-cancelada"}">${m.tipo}</span></td>
        <td>${m.concepto}</td>
        <td>Bs. ${Number(m.monto).toFixed(2)}</td>
        <td>${m.fecha}</td>
        <td><button type="button" class="btn-sm danger" data-del-mov="${m.id}">Borrar</button></td>
      </tr>`).join("");
    tbody.querySelectorAll("[data-del-mov]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await window.supabaseClient.from("movimientos").delete().eq("id", btn.getAttribute("data-del-mov"));
          mostrarToast("Eliminado", "info");
          cargarMovimientos();
        } catch (e) {
          mostrarToast("No se pudo borrar", "error");
        }
      });
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5">No conectado a Supabase o falta la tabla movimientos. Ejecutá schema.sql.</td></tr>';
  }
}


async function cargarComprobantesAdmin() {
  const tbody = document.getElementById("adminComprobantesBody");
  if (!tbody) return;
  try {
    const { data, error } = await window.supabaseClient
      .from("reservas")
      .select("*")
      .eq("estado", "pago_reportado")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--acero);">No hay comprobantes con foto pendientes.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((r) => `
      <tr>
        <td><strong>${r.nombre_cliente}</strong><br><small>${r.telefono || ""}</small><br><small>${r.email || ""}</small></td>
        <td>${r.servicio_nombre || "-"}<br><small>${r.fecha} ${r.horario || ""}</small>
          ${r.comprobante_nota ? `<br><small>${r.comprobante_nota}</small>` : ""}</td>
        <td>${r.comprobante_imagen
          ? `<a href="${r.comprobante_imagen}" target="_blank" rel="noopener"><img src="${r.comprobante_imagen}" alt="Comprobante" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #D8E2F0;"/></a>`
          : "<small>Sin foto</small>"}</td>
        <td>Bs. ${Number(r.costo_reserva || 10).toFixed(2)}</td>
        <td>
          <button type="button" class="btn-sm save" data-confirmar-pago="${r.id}">Confirmar pago</button>
          <button type="button" class="btn-sm danger" data-rechazar-pago="${r.id}">Rechazar</button>
        </td>
      </tr>`).join("");
    tbody.querySelectorAll("[data-confirmar-pago]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-confirmar-pago"), 10);
        btn.disabled = true;
        btn.textContent = "Confirmando...";
        try {
          const { data, error } = await window.supabaseClient.from("reservas")
            .update({ estado: "confirmada", visto_cliente: false })
            .eq("id", id)
            .select("id, estado, nombre_cliente")
            .maybeSingle();
          if (error) throw error;
          if (!data || data.estado !== "confirmada") {
            mostrarToast("No se confirmó. Revisá permisos de la tabla reservas.", "error");
            return;
          }
          mostrarToast('Pago aceptado. Pasó a Agenda (aceptadas) y el cliente ve CONFIRMADA.', 'success');
          await cargarPanelAdmin();
        } catch (e) {
          console.error(e);
          mostrarToast("No se pudo confirmar: " + (e.message || "error"), "error");
        }
      });
    });
    tbody.querySelectorAll("[data-rechazar-pago]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-rechazar-pago"), 10);
        try {
          const { error } = await window.supabaseClient.from("reservas")
            .update({ estado: "cancelada" })
            .eq("id", id);
          if (error) throw error;
          mostrarToast("Comprobante rechazado / reserva cancelada", "info");
          await cargarPanelAdmin();
        } catch (e) {
          mostrarToast("No se pudo rechazar: " + (e.message || "error"), "error");
        }
      });
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5">Error al cargar comprobantes.</td></tr>';
  }
}

async function cargarEsperandoPagoAdmin() {
  const tbody = document.getElementById("adminEsperandoBody");
  if (!tbody) return;
  try {
    const { data, error } = await window.supabaseClient
      .from("reservas")
      .select("*")
      .eq("estado", "esperando_pago")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:var(--acero);">Nadie esperando pago por ahora.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((r) => `
      <tr>
        <td><strong>${r.nombre_cliente}</strong><br><small>${r.telefono || ""}</small></td>
        <td>${r.servicio_nombre || "-"}</td>
        <td>${r.fecha} ${r.horario || ""}</td>
        <td>Bs. ${Number(r.costo_reserva || 10).toFixed(2)}</td>
        <td><span class="estado-badge estado-pendiente">esperando pago</span></td>
      </tr>`).join("");
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="5">Error al cargar.</td></tr>';
  }
}


async function cargarUIDisponibilidadAdmin() {
  const sel = document.getElementById("cfgAbierto");
  if (!sel) return;
  await cargarConfigNegocio();
  sel.value = configNegocio.abierto ? "true" : "false";
  document.querySelectorAll(".cfg-dia").forEach((chk) => {
    chk.checked = (configNegocio.dias_habiles || []).includes(chk.value);
  });
  const fer = document.getElementById("cfgFeriados");
  if (fer) fer.value = (configNegocio.feriados || []).join(", ");

  const btn = document.getElementById("btnGuardarDisponibilidad");
  if (btn) {
    btn.onclick = async () => {
      const abierto = document.getElementById("cfgAbierto").value === "true";
      const dias = [...document.querySelectorAll(".cfg-dia:checked")].map((c) => c.value);
      const feriados = (document.getElementById("cfgFeriados").value || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
      await guardarConfigNegocio({ abierto, dias_habiles: dias, feriados });
      mostrarToast("Disponibilidad guardada", "success");
    };
  }
}

async function guardarPrecio(id) {
  if (!clienteListo()) { avisarSinSupabase(); return; }
  const input = document.querySelector('.input-precio[data-id="' + id + '"]');
  if (!input) { mostrarToast("No se encontró el campo de precio", "error"); return; }
  const inputDesc = document.querySelector('.input-desc[data-id="' + id + '"]');
  const precio = parseFloat(String(input.value).replace(",", "."));
  if (isNaN(precio) || precio < 0) { mostrarToast("Precio inválido", "error"); return; }
  const descripcion = inputDesc ? String(inputDesc.value || "").trim() : "";
  const idNum = parseInt(id, 10);

  try {
    // 1) Update precio + texto en tabla servicios
    const payload = { precio_desde: precio };
    if (descripcion) payload.descripcion = descripcion;
    const { error: upErr } = await window.supabaseClient
      .from("servicios")
      .update(payload)
      .eq("id", idNum);
    if (upErr) throw upErr;

    // 2) Leer servicios y sincronizar duplicados con el mismo nombre
    let { data: todos, error: selErr } = await window.supabaseClient
      .from("servicios")
      .select("id, nombre, descripcion, precio_desde, activo")
      .order("id");
    if (selErr) throw selErr;

    const row0 = (todos || []).find((x) => Number(x.id) === idNum);
    if (row0) {
      const mismos = (todos || []).filter((x) => String(x.nombre).trim().toLowerCase() === String(row0.nombre).trim().toLowerCase() && Number(x.id) !== idNum);
      for (const d of mismos) {
        const p = { precio_desde: precio };
        if (descripcion) p.descripcion = descripcion;
        await window.supabaseClient.from("servicios").update(p).eq("id", d.id);
      }
      // releer
      const reread = await window.supabaseClient.from("servicios").select("id, nombre, descripcion, precio_desde, activo").order("id");
      todos = reread.data || todos;
    }

    const lista = deduplicarServicios(todos || []);
    const row = lista.find((x) => Number(x.id) === idNum) || lista.find((x) => row0 && x.nombre === row0.nombre);
    if (row && Number(row.precio_desde) !== Number(precio)) {
      mostrarToast("Supabase no guardó el precio (RLS). Ejecutá: ALTER TABLE servicios DISABLE ROW LEVEL SECURITY;", "error");
      return;
    }

    // 3) Guardar copia en configuracion (más confiable para el sitio)
    try {
      await window.supabaseClient.from("configuracion").upsert({
        clave: "precios_json",
        valor: JSON.stringify(lista)
      });
    } catch (e) { console.warn(e); }

    // 4) Cache local del navegador
    try { localStorage.setItem("servitec_precios", JSON.stringify(lista)); } catch (e) {}

    // 5) Pintar en esta página si hay cards
    aplicarPreciosEnPantalla(lista);

    mostrarToast("Precio guardado: Bs. " + precio + ". Abrí Inicio con Ctrl+F5 para verlo.", "success");
    await cargarServicios();
    if (document.getElementById("adminServiciosBody")) await cargarPanelAdmin();
  } catch (e) {
    console.error(e);
    mostrarToast("Error al guardar precio: " + (e.message || e) + " — desactivá RLS de servicios", "error");
  }
}

async function cambiarEstadoReserva(id, estado) {
  try {
    const payload = { estado };
    if (estado === "confirmada") payload.visto_cliente = false;
    const { error } = await window.supabaseClient.from("reservas").update(payload).eq("id", parseInt(id, 10));
    if (error) throw error;
    mostrarToast("Estado actualizado a: " + estado, "success");
    await cargarPanelAdmin();
  } catch (e) {
    console.error(e);
    mostrarToast("No se pudo cambiar el estado: " + (e.message || "error"), "error");
  }
}

// ---------- CONTACTO ----------
function iniciarFormContacto() {
  const form = document.getElementById("form-contacto");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("c-nombre")?.value.trim() || "";
    const tel = document.getElementById("c-tel")?.value.trim() || "";
    const correo = document.getElementById("c-correo")?.value.trim() || "";
    const asunto = document.getElementById("c-asunto")?.value || "";
    const mensaje = document.getElementById("c-mensaje")?.value.trim() || "";

    if (!nombre) { mostrarToast("Escribí tu nombre", "error"); document.getElementById("c-nombre")?.focus(); return; }
    if (!tel) { mostrarToast("Escribí tu teléfono", "error"); document.getElementById("c-tel")?.focus(); return; }
    if (!asunto) { mostrarToast("Seleccioná un asunto", "error"); document.getElementById("c-asunto")?.focus(); return; }
    if (!mensaje) { mostrarToast("Escribí tu mensaje", "error"); document.getElementById("c-mensaje")?.focus(); return; }

    const texto = [
      "Hola ServiTec, consulta desde la web:",
      "",
      "Nombre: " + nombre,
      "Teléfono: " + tel,
      correo ? "Correo: " + correo : null,
      "Asunto: " + asunto,
      "",
      "Mensaje:",
      mensaje
    ].filter(Boolean).join("\n");

    window.open("https://wa.me/59178118558?text=" + encodeURIComponent(texto), "_blank");
    mostrarToast("Abriendo WhatsApp con tu mensaje…", "success");
    form.reset();
  });
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  // Precios desde cache al instante (antes de Supabase)
  try {
    const cached = JSON.parse(localStorage.getItem("servitec_precios") || "[]");
    if (cached && cached.length && typeof aplicarPreciosEnPantalla === "function") {
      aplicarPreciosEnPantalla(cached);
    }
  } catch (e) {}

  // UI local primero (no depende de Supabase)
  iniciarMenuMovil();
  iniciarTracker();
  crearModalAuth();
  iniciarFormContacto();
  iniciarMenuAdmin();

  const fechaInput = document.getElementById("fecha");
  if (fechaInput) {
    const t = new Date();
    fechaInput.min = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }
  const nombreInput = document.getElementById("nombre");
  if (nombreInput) nombreInput.addEventListener("input", () => { nombreInput.value = nombreInput.value.replace(/[0-9]/g, ""); });
  const telInput = document.getElementById("tel");
  if (telInput) telInput.addEventListener("input", () => { telInput.value = telInput.value.replace(/[^0-9+ ]/g, ""); });

  document.querySelectorAll("[data-open-login]").forEach((btn) => {
    btn.addEventListener("click", () => abrirModalAuth(btn.getAttribute("data-tab") || "login"));
  });

  const formReserva = document.getElementById("form-reserva");
  sincronizarDatosLocalDesdeSupabase().then(() => aplicarDatosLocal());
  if (formReserva) formReserva.addEventListener("submit", enviarReserva);
  const btnYaPague = document.getElementById("btnYaPague");
  if (btnYaPague) btnYaPague.addEventListener("click", enviarComprobantePago);

  const btnNuevaReserva = document.getElementById("btnNuevaReserva");
  if (btnNuevaReserva) {
    btnNuevaReserva.addEventListener("click", () => {
      reservaPendientePago = null;
      const exito = document.getElementById("reservaExito");
      const formWrap = document.getElementById("formWrap");
      const form = document.getElementById("form-reserva");
      if (exito) exito.style.display = "none";
      if (formWrap) formWrap.style.display = "block";
      if (form) {
        form.reset();
        form.style.display = "block";
      }
      const precioBox = document.getElementById("precioBox");
      if (precioBox) precioBox.style.display = "none";
      // restaurar panel de pago por si quedó el mensaje de éxito
      const box = document.getElementById("pagoBox");
      if (box && typeof htmlPanelPago === "function") {
        box.innerHTML = htmlPanelPago();
        if (typeof cablearPanelPago === "function") cablearPanelPago();
      }
      cargarMisReservas();
      if (formWrap) formWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      mostrarToast("Podés cargar una nueva reserva", "info");
    });
  }

  const fotoComp = document.getElementById("fotoComprobante");
  if (fotoComp) {
    fotoComp.addEventListener("change", () => {
      const f = fotoComp.files && fotoComp.files[0];
      const prev = document.getElementById("previewComprobante");
      const img = document.getElementById("previewComprobanteImg");
      if (f && img && prev) {
        const url = URL.createObjectURL(f);
        img.src = url;
        prev.style.display = "block";
      }
    });
  }


  // Supabase (si aún no hay keys, la web igual se ve; login avisará al intentar)
  try {
    // Diagnóstico en consola (F12)
    console.log("[ServiTec] página:", location.href);
    console.log("[ServiTec] supabase lib:", typeof window.supabase);
    console.log("[ServiTec] client:", window.supabaseClient);
    console.log("[ServiTec] msg:", window.__servitecSupabaseMsg);

    if (clienteListo()) {
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          usuarioActual = null;
          perfilActual = null;
          recordarAdminLocal(false);
          _adminPanelListo = false;
          _adminLoginPedido = false;
          actualizarUIAuth();
          if (document.body.dataset.page === "admin") {
            mostrarToast("Sesión cerrada", "info");
            abrirModalAuth("login");
          }
          return;
        }
        if (event === "SIGNED_IN") {
          _adminLoginPedido = false;
          cargarSesion({ fromAuth: true, event: "SIGNED_IN" });
          return;
        }
        if (event === "TOKEN_REFRESHED") {
          // Solo actualiza el user en memoria; no recarga UI ni pide login
          if (session && session.user) {
            usuarioActual = session.user;
          }
        }
      });
      cargarSesion().then(async () => {
        await cargarConfigNegocio();
        await cargarServicios();
      });
    } else {
      console.warn("[ServiTec] SIN cliente. Probá: fetch('js/supabaseClient.js').then(r=>r.text()).then(t=>console.log('archivo tiene placeholder', t.includes('TU_SUPABASE')))");
      ["adminServiciosBody", "adminReservasBody", "adminMovimientosBody"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<tr><td colspan="6">Cuando conectes Supabase, aquí verás los datos.</td></tr>';
      });
    }
  } catch (e) {
    console.error(e);
  }
});
