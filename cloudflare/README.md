# Soy Amor Universal 111 — Cloudflare staging

Última actualización: 14/10/2026. Sitio público real: GitHub Pages con Supabase (`main`). **No cambiar el dominio real sin cerrar la lista de validaciones.**

## Instalación de pruebas

- **Worker:** `soy-amor-eventos-staging`.
- **URL:** https://soy-amor-eventos-staging.melisatenaglia.workers.dev
- **D1:** `soy-amor-eventos-staging` (jurisdicción `eu`), binding `DB`.
- **Github:** rama `staging`; Cloudflare actualizado a través de su API, **sin CI/CD de despliegue automático**.
- **Web pública:** HTML/CSS/JS originales servidos por el Worker desde `site/`.
- **Panel administrativo:** `/admin/`, con cliente de compatibilidad `src/compat.txt`.
- **API:** `src/backend.js`, datos y permisos en D1, sesiones HttpOnly Secure SameSite=Strict.
- **Migración de usuarios:** primera entrada valida correo/contraseña contra Supabase Auth y comprueba el rol de la cuenta en Supabase antes de guardar un hash PBKDF2 en D1. El login posterior no usa Supabase. El primer acceso de Melisa se ha validado. La cuenta de Sofía está preinscrita sin contraseña, pendiente de su primer acceso.
- **Tablas:** `schema.sql` + `migrations/0002_auth_media.sql`.
- **Imágenes nuevas:** comprimidas automáticamente a WebP y guardadas en D1 (`media`), límite 400 KB. **R2 no está habilitado** en la cuenta actual de Cloudflare.
- **Imágenes históricas:** las subirá Melisa desde **Editar evento**. La importación automática se retiró porque no es necesaria. Esto **no bloquea** el desarrollo ni las pruebas de turnos. Las URLs antiguas pueden seguir apuntando temporalmente a Supabase.
- **Tests:** `tests/smoke.mjs` y `tests/concurrency_sqlite.py`; workflow de GitHub Actions para `staging` creado. No se ha confirmado aún que el workflow se haya ejecutado correctamente.

### Estado de la copia inicial de Supabase (13/10/2026)

- 6 eventos, 11 servicios asociados, 5 plantillas de servicios, 1 configuración, 13 turnos históricos.
- Más 1 evento y 1 servicio ficticio de staging; el evento ficticio está en borrador.
- **Todas las listas de espera cerradas en staging** para evitar que se mezclen con las reales.
- Dos administradoras registradas: Melisa con acceso activado y Sofía pendiente de su primer inicio de sesión (no se copiaron contraseñas).
- Los 13 tokens originales de los dispositivos de la copia de turnos fueron anonimizados exclusivamente en staging (migración `staging-anonymize-turns.sql`). El histórico de números y estados se conserva. La copia inicial no es una sincronización continua. Antes del corte real se debe repetir la importación de los datos modificados después del 13/10/2026 (incluidos los turnos) con un procedimiento de sincronización, sin duplicar ni sobrescribir indebidamente.

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
- Límite básico de **120 solicitudes por IP y evento cada 10 minutos**, para no bloquear a asistentes que comparten Wi-Fi.
- El número siguiente no se anuncia como probado bajo concurrencia real hasta ejecutar pruebas integradas en Cloudflare.

## Pasos obligatorios antes de producción

1. La URL de staging, el panel y el login se abrieron correctamente en el navegador de Melisa. Sigue pendiente la batería completa de pruebas reales de emisión/atención de turnos y roles.
2. Validar el primer inicio de sesión de Sofía y sus permisos de administradora en móvil. Melisa ya entró correctamente.
3. Ejecutar tests de regresión, dos dispositivos simultáneos, máximo de turnos, reconexión y flujo de WhatsApp.
4. Cuando Melisa suba las imágenes desde Editar evento, comprobar que se guardan como `/media/<id>` en D1 y se visualizan correctamente. Pendiente visual **no bloqueante** para las pruebas técnicas.
5. Hacer auditoría de interfaz móvil y del panel administrativo.
6. Establecer copia de seguridad, sincronización final Supabase → D1 sin duplicados y una ventana sin colas abiertas; asegurar que `created_by` corresponde a las cuentas nuevas si se utiliza.
7. Desactivar/retirar `/api/auth/migrate` cuando se haya terminado el traspaso de identidades.
8. Desplegar una base y Worker **de producción independientes de staging**, migrar datos finales, verificar y después redirigir el dominio `eventos.soyamoruniversal111.com`. Nunca apuntar el dominio a la base de staging directamente. **BLOQUEO DNS:** en la cuenta Cloudflare solo existe la zona `aficionadxs.art`; no está `soyamoruniversal111.com`. Se debe revisar dónde se administran sus DNS, inventariar registros de Odoo/correo y pedir autorización antes de mover nameservers.

### Pendientes no bloqueantes del prototipo
- Recuperación automática de contraseña por correo: requiere proveedor de correo transaccional; actualmente no disponible, panel muestra mensaje claro.
- Las cinco imágenes siguen apuntando a Supabase hasta que Melisa las vuelva a subir. No se desconectará Supabase antes de completar la transición.
- Las imágenes nuevas se guardan con URL relativa `/media/<id>` para que los enlaces no dependan del hostname del entorno de pruebas.
- CI/CD de despliegues: hoy los cambios de GitHub no actualizan Worker solos.

### Reglas
No compartir tokens, contraseñas ni claves de gestión en el repositorio/frontend. No abrir turnos reales en staging. No cambiar el DNS de producción hasta completar la validación.

## Pruebas ya ejecutadas y sus límites

- Validado el primer inicio de sesión de Melisa en Cloudflare (confirmado por ella) y persistencia de su usuario D1.
- Confirmada por consulta de D1 la existencia de 6 eventos, 11 servicios, 13 turnos históricos y dos roles admin.
- Ejecutada prueba local en SQLite/WAL con 50 solicitudes simultáneas: 15 turnos únicos frente al límite 15 y reintentos idempotentes. Es una verificación de la lógica SQL; todavía requiere prueba end-to-end del Worker con dos móviles.
- Cloudflare confirma despliegue exitoso; falta batería completa de UI y sesión de Sofía.
