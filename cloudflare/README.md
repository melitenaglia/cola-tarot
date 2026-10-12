# Soy Amor Universal 111 · Cloudflare staging

Entorno de pruebas **independiente** del sitio real en GitHub Pages.

## Estado

- Worker `soy-amor-eventos-staging` de prueba.
- `/health` muestra el estado del Worker y prueba `SELECT 1` cuando se haya conectado una base D1 llamada `DB`.
- **No usa credenciales de Supabase ni su base de datos**.
- El frontend, la base y la lógica de turnos actuales siguen en `main` y no están migrados.

## Configuración en Cloudflare

1. Workers & Pages → Create application → Import a repository.
2. Repo `melitenaglia/cola-tarot` y rama de producción del Worker **staging** (es producción solo de este Worker de pruebas).
3. Worker name `soy-amor-eventos-staging`.
4. Root directory `/cloudflare` (o `cloudflare` si la interfaz no acepta / inicial).
5. Build command: vacío (sin proceso de compilación).
6. Deploy command: `npx wrangler deploy`.
7. Sin custom domain. Usar URL temporal `*.workers.dev`.

Tras el primer despliegue, crear base D1 `soy-amor-eventos-staging` (separada de cualquier producción) y añadir binding `DB` al Worker. Para futuros deploys, declarar el binding con su database_id en `wrangler.jsonc` de staging (Git como fuente de verdad).

## Regla de seguridad

No copiar datos reales de clientes/turnos a staging sin anonimizar, ni mezclar la D1 de staging con la futura D1 de producción. No añadir keys privadas al repositorio.
El acceso al panel se implementará en Workers con controles de autorización y antifraude; Cloudflare Access puede restringir el panel pero no reemplaza necesariamente el modelo de roles admin/staff.
El contador consecutivo de turnos debe migrarse con transacciones atómicas que eviten duplicaciones concurrentes.

## Despliegue de producción

No vincular `eventos.soyamoruniversal111.com` a este Worker. No hacer merge a `main` hasta que la migración, los permisos, backups y circuitos de turnos estén verificados.
