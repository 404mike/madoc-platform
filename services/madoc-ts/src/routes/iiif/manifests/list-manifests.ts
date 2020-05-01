import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';
import { mapMetadata } from '../../../utility/iiif-metadata';
import { getMetadata } from '../../../utility/iiif-database-helpers';

// @todo come back to group by for multiple scopes.
// @todo add manifest thumbnail
// @todo pagination
export const listManifests: RouteMiddleware = async context => {
  const { siteId, sitePostgresId } = userWithScope(context, []);

  const manifestRows = await context.connection.many<{
    resource_id: number;
    created_at: Date;
    key: string;
    value: string;
    language: string;
    source: string;
  }>(
    getMetadata(
      sql`select *, manifest_thumbnail(${siteId}, resource_id) as thumbnail from iiif_derivative where type = 'manifest' and context <@ ${sitePostgresId}`,
      siteId,
      ['label']
    )
  );

  const manifests = mapMetadata(manifestRows);

  context.response.body = {
    manifests,
    page: 0,
  };
};
