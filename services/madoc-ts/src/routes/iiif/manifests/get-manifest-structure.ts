import { RouteMiddleware } from '../../../types';
import { userWithScope } from '../../../utility/user-with-scope';
import { sql } from 'slonik';

/**
 * @todo when canvas exist.
 * @todo label and id for manifest
 * @param context
 */
export const getManifestStructure: RouteMiddleware<{ id: number }> = async context => {
  const { sitePostgresId } = userWithScope(context, []);

  const manifest_id = context.params.id;
  const ctx = `${sitePostgresId}.*.manifest_${manifest_id}`;

  const canvases = await context.connection.any<any>(sql`
    select * from iiif_derivative where context ~ ${ctx} and type = 'canvas'
  `);

  context.response.body = { canvases };
};
