// Soy Amor Universal 111 · Entorno de pruebas de Cloudflare.
// No usar ni exponer los datos de produccion de Supabase desde este entorno.
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      let database = "sin_configurar";
      if (env.DB) {
        try {
          const row = await env.DB.prepare("SELECT 1 AS ok").first();
          database = row?.ok === 1 ? "conectada" : "error";
        } catch {
          database = "error";
        }
      }
      return new Response(
        JSON.stringify({ entorno: "staging", servicio: "soy-amor-eventos", online: true, database }),
        { status: 200, headers }
      );
    }

    if (url.pathname !== "/") {
      return new Response("No encontrado", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
      });
    }

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Soy Amor · Staging</title>
  <style>
    *{box-sizing:border-box}
    body{font:16px/1.55 system-ui,sans-serif;background:#f8f5ed;color:#282521;margin:0;min-height:100vh;display:grid;place-items:center;padding:22px}
    main{background:white;max-width:560px;padding:32px;border:1px solid #e3dacb;border-radius:14px}
    h1{font-size:27px;margin:0 0 8px}
    p{margin:0 0 16px}
    small{color:#5e594d}
    a{color:#5c442b}
  </style>
</head>
<body>
  <main>
    <small>SOY AMOR UNIVERSAL 111 · ENTORNO DE PRUEBAS</small>
    <h1>Preparando la nueva plataforma de eventos</h1>
    <p>Esta es una instalación de prueba en Cloudflare. Todavía no está conectada a la lista de espera ni a los datos reales.</p>
    <p>La web de eventos que utiliza Sofi sigue funcionando por separado.</p>
    <a href="/health">Comprobar estado técnico</a>
  </main>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
