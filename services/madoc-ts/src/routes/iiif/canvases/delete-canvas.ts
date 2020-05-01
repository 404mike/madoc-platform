import { RouteMiddleware } from '../../../types';
import { userWithScope } from '../../../utility/user-with-scope';
import { sql } from 'slonik';

export const deleteCanvas: RouteMiddleware<{ id: number }> = async context => {
  const { sitePostgresId } = userWithScope(context, ['site.admin']);

  await context.query.any(
    sql`delete from iiif_derivative where resource_id = ${context.params.id} and type = 'canvas' and context <@ ${sitePostgresId}`
  );

  context.response.status = 200;
};
