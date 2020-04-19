import fetch from 'cross-fetch';

export async function fetchJson<Return>(
  apiGateway: string,
  endpoint: string,
  {
    method = 'GET',
    body,
    jwt,
  }: { method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'; body?: any; jwt: string }
): Promise<Return> {
  const headers: any = {
    Accept: 'application/json',
    Authorization: `Bearer ${jwt}`,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${apiGateway}${endpoint}`, {
    headers,
    method,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'omit',
  })
    .then(r => r.json())
    .catch(err => {
      console.log(err);
      throw err;
    });
}
