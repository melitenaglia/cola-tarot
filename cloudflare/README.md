# Soy Amor Universal 111 — Cloudflare staging

Última actualización: 13/10/2026. Sitio público real: GitHub Pages con Supabase (`main`). **No cambiar el dominio real sin cerrar la lista de validaciones.**

## Instalación de pruebas

- **Worker:** `soy-amor-eventos-staging`.
- **URL:** https://soy-amor-eventos-staging.melisatenaglia.workers.dev
- **D1:** `soy-amor-eventos-staging` (jurisdicción `eu`), binding `DB`.
- **Github:** rama `staging`; Cloudflare actualizado a través de su API, **sin CI/CD de despliegue automático**.
- **Web pública:** HTML/CSS/JS originales servidos por el Worker desde `site/`.
- **Panel administrativo:** `/admin/`, con cliente de compatibilidad `src/compat.txt`.
- **API:** `src/backend.js`, datos y permisos en D1, sesiones HttpOnly Secure SameSite=Strict.
- **Migración de usuarios:** primera entrada valida correo/contraseña contra Supabase Auth y comprueba el rol de la cuenta en Supabase antes de guardar un hash PBKDF2 en D1. El login posterior no usa Supabase. La importación solo funciona mientras Supabase responde y hay que probarla con las cuentas reales.
- **Tablas:** `schema.sql` + `migrations/0002_auth_media.sql`.
- **Imágenes nuevas:** comprimidas automáticamente a WebP y guardadas en D1 (`media`), límite 400 KB. **R2 no está habilitado** en la cuenta actual de Cloudflare.
- **Carteles históricos:** botón «Copiar carteles a Cloudflare» en Configuración, a ejecutar con cuenta administradora; si falla CORS, se deben subir manualmente los originales.
- **Tests:** `tests/smoke.mjs` con `node --experimental-sqlite`; workflow de GitHub Actions para `staging` creado. No se ha confirmado aún que el workflow se haya ejecutado correctamente.

### Estado de la copia inicial de Supabase (13/10/2026)

- 6 eventos, 11 servicios asociados, 5 plantillas de servicios, 1 configuración, 13 turnos históricos.
- Más 1 evento y 1 servicio ficticio de staging; el evento ficticio está en borrador.
- **Todas las listas de espera cerradas en staging** para evitar que se mezclen con las reales.
- Los perfiles no se copian con contraseñas: cada persona se activa al primer acceso con credenciales válidas.
- La copia inicial no es una sincronización continua. Antes del corte real se debe repetir la importación de los datos modificados después del 13/10/2026 (incluidos los turnos) con un procedimiento de sincronización, sin duplicar ni sobrescribir indebidamente.

### Endpoints

- `GET /health`
- `GET /api/data/events` y `GET /api/data/services` (lectura pública, filtran por visibilidad)
- `POST /api/rpc` (`issue_turn`, `get_queue_position` públicos con validación, el resto exige sesión)
- `POST /api/auth/login`, `/api/auth/migrate`, `/api/auth/logout`
- `GET /api/auth/session`
- `POST /api/data/{events|services|service_templates|app_settings}` (sesión y rol)
- `POST /api/admin/create-user` y `/api/admin/update-user` (solo administradores)
- `POST /api/media/upload` (solo usuarios autorizados)
- `GET /media/{id}` (carteles públicos)

### Protección de turnos

- `UNIQUE(event_id,number)` y `UNIQUE(event_id,device_token)`.
- Reasignación del mismo turno si el dispositivo ya lo tiene.
- `DB.batch` con actualización de contador y creación de turno en una transacción, respetando capacidad y horarios. Rechaza eventos cerrados.
- Límite básico de intentos por IP/evento.
- El número siguiente no se anuncia como probado bajo concurrencia real hasta ejecutar pruebas integradas en Cloudflare.

## Pasos obligatorios antes de producción

1. Verificar carga de la URL de staging desde un navegador real y endpoints HTTP; Cloudflare aceptó los despliegues pero el entorno de herramientas no tiene acceso externo al subdominio.
2. Iniciar sesión por primera vez en staging con ambas cuentas (Melisa y Sofía); comprobar roles y acciones y que un segundo login ya no necesita Supabase.
3. Ejecutar tests de regresión, dos dispositivos simultáneos, máximo de turnos, reconexión y flujo de WhatsApp.
4. Copiar **todos** los carteles históricos a Cloudflare y verificar sus URL locales.
5. Hacer auditoría de interfaz móvil y del panel administrativo.
6. Establecer copia de seguridad, sincronización final Supabase → D1 sin duplicados y una ventana sin colas abiertas; asegurar que `created_by` corresponde a las cuentas nuevas si se utiliza.
7. Desactivar/retirar `/api/auth/migrate` cuando se haya terminado el traspaso de identidades.
8. Desplegar una base y Worker **de producción independientes de staging**, migrar datos finales, verificar y después redirigir el dominio `eventos.soyamoruniversal111.com`. Nunca apuntar el dominio a la base de staging directamente.

### Pendientes no bloqueantes del prototipo
- Recuperación automática de contraseña por correo: requiere proveedor de correo transaccional; actualmente no disponible, panel muestra mensaje claro.
- CI/CD de despliegues: hoy los cambios de GitHub no actualizan Worker solos.

### Reglas
No compartir tokens, contraseñas ni claves de gestión en el repositorio/frontend. No abrir turnos reales en staging. No cambiar el DNS de producción hasta completar la validación.
