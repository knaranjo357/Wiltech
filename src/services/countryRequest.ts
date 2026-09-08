import { AuthService } from './authService';

/** All business requests carry the authenticated country; never infer it from a city. */
export function countryFetch(input: string, init: RequestInit = {}, userPermissions = false): Promise<Response> {
  const country = AuthService.getPaisSede();
  const url = new URL(input, window.location.origin);
  const requested = url.searchParams.get('pais_sede');
  if (requested && requested !== country) throw new Error('El país solicitado no coincide con la sesión.');
  url.searchParams.set('pais_sede', country);
  // UserService validates assigned permissions separately from the active query country.
  if (userPermissions && (!['/webhook/wiltech/usuarios', '/webhook/wiltech/modificar-usuarios'].includes(url.pathname) || init.method !== 'POST')) {
    throw new Error('Endpoint inválido para asignar países.');
  }
  let body = init.body;
  if (body instanceof FormData) {
    const form = new FormData();
    body.forEach((value, key) => form.append(key, value));
    const supplied = form.get('pais_sede');
    if (!userPermissions && supplied && supplied !== country) throw new Error('El país del registro no coincide con la sesión.');
    if (!userPermissions) form.set('pais_sede', country);
    body = form;
  } else if (typeof body === 'string') {
    const data = JSON.parse(body);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Se requiere un objeto con contexto de país.');
    if (data.pais_sede && data.pais_sede !== country) throw new Error('El país del registro no coincide con la sesión.');
    body = JSON.stringify({ ...data, pais_sede: country });
  } else if (!body && init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    body = JSON.stringify({ pais_sede: country });
  }
  return fetch(url.toString(), { ...init, body });
}
