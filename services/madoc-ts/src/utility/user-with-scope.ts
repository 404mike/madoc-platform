import { ApplicationState } from '../types';
import { NotFound } from '../errors/not-found';

export function userWithScope(context: { state: ApplicationState }, scopes: string[]) {
  if (!context.state.jwt || context.state.jwt.user.service) {
    throw new NotFound();
  }

  for (const scope of scopes) {
    if (context.state.jwt.scope.indexOf(scope) === -1) {
      throw new NotFound();
    }
  }

  return {
    id: context.state.jwt.user.id,
    name: context.state.jwt.user.name,
    siteId: context.state.jwt.site.id,
    sitePostgresId: `site_${context.state.jwt.site.id}`,
    userUrn: `urn:madoc:user_${context.state.jwt.user.id}`,
  };
}
