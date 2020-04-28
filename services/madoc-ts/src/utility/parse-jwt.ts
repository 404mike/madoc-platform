import { TokenReturn } from './verify-signed-token';
import { ApplicationState } from '../types';

export function parseJWT(token: TokenReturn): ApplicationState['jwt'] {
  const userId = token.payload.service
    ? token.payload.sub.split('urn:madoc:service:')[1]
    : Number(token.payload.sub.split('urn:madoc:user:')[1]);

  const gateway = token.payload.iss === 'urn:madoc:gateway';

  return {
    token: token.token,
    user: {
      id: userId as any,
      service: !!token.payload.service,
      name: token.payload.name,
    },
    site: {
      gateway,
      id: gateway ? 0 : Number(token.payload.iss.split('urn:madoc:site:')[1]),
      name: token.payload.iss_name,
    },
    scope: token.payload.scope.split(' '),
    context: [token.payload.iss],
  };
}
