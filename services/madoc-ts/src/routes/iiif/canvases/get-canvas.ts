import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';
import { mapMetadata } from '../../../utility/iiif-metadata';

// @todo thumbnail for canvas.
export const getCanvas: RouteMiddleware<{ id: string }> = async context => {
  const { siteId } = userWithScope(context, []);

  const canvasId = context.params.id;

  const ctx = `site_${siteId}`;

  const canvas = await context.connection.many<{
    resource_id: number;
    created_at: Date;
    key: string;
    value: string;
    language: string;
    source: string;
  }>(
    sql`select 
            ifd.resource_id, 
            ifd.created_at,
            im.key, 
            im.value, 
            im.language, 
            im.source from iiif_derivative ifd
        left outer join iiif_metadata im on ifd.resource_id = im.resource_id
    where context ~ ${ctx}
    and ifd.resource_id = ${canvasId}
    and ifd.type = 'canvas'
    and im.site_id = ${siteId}
    group by ifd.resource_id, ifd.created_at, im.key, im.value, im.language, im.source
  `
  );

  const mappedMetadata = mapMetadata(canvas);

  context.response.body = mappedMetadata[0];
};
