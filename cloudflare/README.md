# Soy Amor Universal 111 — Migración Cloudflare (staging)

Entorno independiente del sitio principal en GitHub Pages. **No contiene turnos ni cuentas de producción.**

## Estado confirmado
- Worker: `soy-amor-eventos-staging`.
- URL: https://soy-amor-eventos-staging.melisatenaglia.workers.dev
- Base D1: `soy-amor-eventos-staging` (jurisdicción EU).
- Binding: `DB`, declarada en `wrangler.jsonc`.
- Esquema SQLite: `schema.sql` (eventos, configuración, servicios, catálogo, turnos, roles, auditoría).
- Datos ficticios: `staging-demo-001` y servicio `staging-service-001`.
- API pública **solo lectura**:
  - `GET /health`
  - `GET /api/public/settings`
  - `GET /api/public/events`
  - `GET /api/public/events/staging-demo-001`
- Despliegue realizado por Cloudflare API. La integración CI/CD con GitHub todavía **no** está creada; los commits no se despliegan automáticamente.

## Pendiente antes de habilitar turnos reales

1. Implementar autenticación independiente de Supabase con control de roles admin/staff. Verificar accesos y sesiones.
2. Implementar API de escritura con validación estricta, controles de abuso, idempotencia por dispositivo, asignación de turno atómica y pruebas de concurrencia.
3. Migrar las vistas públicas y el panel de administración desde GitHub Pages para que usen la nueva API.
4. Probar el circuito completo, creación de evento, apertura/cierre de cola, atención de turnos, QR y servicios.
5. Planificar exportación y cambio definitivo de datos desde Supabase (incluyendo las imágenes y usuarios) con respaldo y corte controlado.
6. Preparar despliegue automatizado solo de staging y publicar producción cuando sea seguro.

## Protecciones

- **No** conectar el dominio público real a staging.
- No reutilizar la base D1 de producción ni copiar información personal a staging.
- No publicar credenciales o secretos en GitHub/frontend.
- No habilitar turnos hasta implementar autorización, límites e idempotencia.
- Los números de turno deben ser únicos por evento mediante una transacción atómica y restricciones `UNIQUE(event_id, number)`.

## Despliegue manual con Wrangler

Desde `cloudflare/`, con sesión autorizada en la cuenta propietaria:

```sh
npx wrangler deploy
```

Es imprescindible que los cambios en `schema.sql` se apliquen a D1 antes de publicar código que dependa de ellos.
