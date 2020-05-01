import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';

export const getManifestMetadata: RouteMiddleware<{ id: string }> = async context => {
  const { sitePostgresId, siteId } = userWithScope(context, []);
  const manifestId = context.params.id;

  const manifest = await context.connection.many<{
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
            and ifd.type = 'manifest'
            and ifd.resource_id=${manifestId}
            and im.site_id=${siteId}
        `
  );

  context.response.body = {
    fields: manifest,
  };
};
