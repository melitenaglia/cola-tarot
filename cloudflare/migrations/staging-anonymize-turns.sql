-- SOLO STAGING: elimina identificadores persistentes de dispositivos copiados de Supabase.
-- Los códigos y el historial de turnos se conservan, pero el token de dispositivo
-- deja de servir para correlacionar una persona con su uso en producción.
-- NO ejecutar este archivo en una base de producción.
UPDATE turns SET device_token='staging-anon-' || id
WHERE device_token NOT LIKE 'staging-anon-%';
