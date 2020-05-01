import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';

/**
 * @todo when manifests exist.
 * @todo label and id for manifest
 * @param context
 */
export const getCollectionStructure: RouteMiddleware<{ id: number }> = async context => {
  const { sitePostgresId, siteId } = userWithScope(context, []);

  const collectionId = context.params.id;
  const ctx = `${sitePostgresId}.collection_${collectionId}`;

  const manifests = await context.connection.any<any>(sql`
    select *, manifest_thumbnail(${siteId}, resource_id) from iiif_derivative where context ~ ${ctx} and type = 'manifest'
  `);

  context.response.body = { manifests };
};
