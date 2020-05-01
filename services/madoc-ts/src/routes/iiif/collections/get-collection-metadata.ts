import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';

// @todo join to original columns to get canonical value.
export const getCollectionMetadata: RouteMiddleware<{ id: number }> = async context => {
  const { sitePostgresId, siteId } = userWithScope(context, []);
  const collectionId = context.params.id;

  const collection = await context.connection.many<{
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
            and ifd.resource_id=${collectionId}
            and im.site_id=${siteId}
        `
  );

  context.response.body = {
    fields: collection,
  };
};
