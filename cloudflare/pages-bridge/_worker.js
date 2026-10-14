// Entrada pública de Pages (cuando se autorice el cambio de DNS).
// No expone directamente el Worker interno ni requiere mover los nameservers del dominio.
export default {
  async fetch(request, env) {
    if (!env.SOY_AMOR) return new Response('Servicio no configurado', {status: 503});
    return env.SOY_AMOR.fetch(request);
  }
};
