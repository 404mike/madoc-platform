import { RouteMiddleware } from '../../../types';
import { userWithScope } from '../../../utility/user-with-scope';
import { sql } from 'slonik';
import { mapMetadata, MetadataField } from '../../../utility/iiif-metadata';

export const listCanvases: RouteMiddleware = async context => {
  const { sitePostgresId, siteId } = userWithScope(context, []);

  const canvases = await context.connection.any<MetadataField>(sql`
    select 
            ifd.resource_id, 
            ifd.created_at, 
            im.key, 
            im.value, 
            im.language, 
            im.source from iiif_derivative ifd
        left outer join iiif_metadata im on ifd.resource_id = im.resource_id
    where context ~ ${sitePostgresId}
    and ifd.type = 'canvas'
    and im.key = 'label'
    and im.site_id = ${siteId}
    group by ifd.resource_id, ifd.created_at, im.key, im.value, im.language, im.source
    `);

  context.response.body = mapMetadata(canvases);
};
