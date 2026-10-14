# Entrada Pages para eventos.soyamoruniversal111.com

**Preparada en Git, no desplegada ni conectada al dominio.**

Motivo: Cloudflare Workers necesita una zona DNS activa en Cloudflare para usar Custom Domains. Pero **Cloudflare Pages sí permite CNAME de subdominios con DNS externos**, sin transferir nameservers del dominio principal: https://developers.cloudflare.com/pages/configuration/custom-domains/

Arquitectura prevista:

- `eventos.soyamoruniversal111.com` → CNAME `soy-amor-eventos-pages.pages.dev` (se configura solo después de validar la migración).
- Cloudflare Pages `_worker.js` → binding privado `SOY_AMOR` → Worker `soy-amor-eventos` (ya creado sin exposición pública).
- Worker → D1 `soy-amor-eventos-production` (actualmente vacía).

Las service bindings permiten la llamada interna sin URL pública y sin aumento de coste por binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/

Antes de activar el CNAME es imprescindible crear y desplegar el proyecto Pages, comprobar que redirige internamente al Worker y ensayar el circuito de turnos con D1 de producción en una ventana controlada.

**No desplegar ni conectar el dominio todavía.** Mantener GitHub Pages + Supabase real hasta completar las pruebas, el backup y la sincronización final.
