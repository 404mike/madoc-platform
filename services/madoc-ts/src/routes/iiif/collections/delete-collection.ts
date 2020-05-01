import { RouteMiddleware } from '../../../types';
import { userWithScope } from '../../../utility/user-with-scope';
import { sql } from 'slonik';

export const deleteCollection: RouteMiddleware<{ id: number }> = async context => {
  const { sitePostgresId } = userWithScope(context, ['site.admin']);

  await context.connection.any(
    sql`delete from iiif_derivative where resource_id = ${context.params.id} and type = 'collection' and context <@ ${sitePostgresId}`
  );

  context.response.status = 200;
};
