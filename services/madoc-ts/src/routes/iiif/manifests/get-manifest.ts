import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';
import { mapMetadata } from '../../../utility/iiif-metadata';

// @todo come back to group by for multiple scopes.
// @todo manifest thumbnail from canvas
// @todo return all canvases - paginated.
export const getManifest: RouteMiddleware<{ id: string }> = async context => {
  const { siteId } = userWithScope(context, []);

  const manifestId = context.params.id;

  const ctx = `site_${siteId}`;

  const manifests = await context.connection.many<{
    resource_id: number;
    created_at: Date;
    key: string;
    value: string;
    language: string;
    source: string;
    thumbnail: string;
  }>(
    sql`select 
            ifd.resource_id, 
            ifd.created_at, 
            im.key, 
            im.value, 
            im.language, 
            manifest_thumbnail(${siteId}, ${manifestId}) as thumbnail,
            im.source from iiif_derivative ifd
        left outer join iiif_metadata im on ifd.resource_id = im.resource_id
    where context ~ ${ctx}
    and ifd.resource_id = ${manifestId}
    and ifd.type = 'manifest'
    and im.site_id = ${siteId}
    group by ifd.resource_id, ifd.created_at, im.key, im.value, im.language, im.source
  `
  );

  const mappedMetadata = mapMetadata(manifests);

  context.response.body = mappedMetadata[0];
};
