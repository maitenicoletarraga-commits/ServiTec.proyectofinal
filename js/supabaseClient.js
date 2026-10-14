/* =====================================================
   SERVITEC - Cliente de Supabase
   -----------------------------------------------------
   1) Supabase → Project Settings → API
   2) Pegá Project URL y anon public key abajo
   3) Guardá y subí a GitHub / Vercel
   ===================================================== */

const SUPABASE_URL = "https://unrsakstqdztxtianioz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucnNha3N0cWR6dHh0aWFuaW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTQyMjUsImV4cCI6MjEwNDk5MDIyNX0.YEa4b8RZpSdfddssKOm66KJZM83TEVgSDSUqEq8f4LM";

window.supabaseClient = null;
window.__servitecSupabaseMsg = "iniciando...";

function crearClienteSupabase() {
  try {
    const url = String(SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "");
    const key = String(SUPABASE_ANON_KEY || "").trim().replace(/^["']|["']$/g, "");

    if (!url || !key || url.indexOf("TU_SUPABASE") >= 0 || key.indexOf("TU_SUPABASE") >= 0) {
      window.supabaseClient = null;
      window.__servitecSupabaseMsg = "Pegá tu Project URL y anon key en este archivo.";
      return false;
    }
    if (url.indexOf("https://") !== 0) {
      window.supabaseClient = null;
      window.__servitecSupabaseMsg = "La URL debe empezar con https://";
      return false;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      window.supabaseClient = null;
      window.__servitecSupabaseMsg = "No cargó la librería de Supabase.";
      return false;
    }

    window.supabaseClient = window.supabase.createClient(url, key);
    window.__servitecSupabaseMsg = "ok";
    console.info("[ServiTec] Supabase conectado:", url);
    return true;
  } catch (e) {
    window.supabaseClient = null;
    window.__servitecSupabaseMsg = "Error: " + (e.message || e);
    console.error(e);
    return false;
  }
}

function asegurarSupabase(callback) {
  if (window.supabaseClient) {
    if (callback) callback(true);
    return;
  }
  function intentar() {
    const ok = crearClienteSupabase();
    if (ok) {
      if (callback) callback(true);
      return;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      if (document.getElementById("supabase-cdn-loader")) {
        if (callback) callback(false);
        return;
      }
      const s = document.createElement("script");
      s.id = "supabase-cdn-loader";
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
      s.onload = function () {
        if (callback) callback(crearClienteSupabase());
      };
      s.onerror = function () {
        window.__servitecSupabaseMsg = "No se pudo descargar Supabase.";
        if (callback) callback(false);
      };
      document.head.appendChild(s);
      return;
    }
    if (callback) callback(false);
  }
  intentar();
}

crearClienteSupabase();
window.addEventListener("load", function () {
  if (!window.supabaseClient) crearClienteSupabase();
});
window.asegurarSupabase = asegurarSupabase;
window.crearClienteSupabase = crearClienteSupabase;
