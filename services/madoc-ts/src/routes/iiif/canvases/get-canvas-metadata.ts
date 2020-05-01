import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';

// @todo maybe de-duplicate these endpoints.
export const getCanvasMetadata: RouteMiddleware<{ id: string }> = async context => {
  const { sitePostgresId, siteId } = userWithScope(context, []);
  const canvasId = context.params.id;

  const canvas = await context.connection.many<{
    key: string;
    value: string;
    language: string;
    source: string;
    edited: boolean;
    auto_update: boolean;
    readonly: boolean;
    data: any;
  }>(
    sql`select 
            im.id,
            im.key, 
            im.value, 
            im.language, 
            im.source,
            im.edited,
            im.auto_update,
            im.readonly,
            im.data
        from iiif_derivative ifd
        left join  iiif_metadata im 
            on ifd.resource_id = im.resource_id 
        where context <@ ${sitePostgresId} 
            and ifd.type = 'canvas'
            and ifd.resource_id=${canvasId}
            and im.site_id=${siteId}
        group by im.id, im.key, im.value, im.language, im.source, im.edited, im.auto_update, im.readonly, im.data
        `
  );

  context.response.body = {
    fields: canvas,
  };
};
