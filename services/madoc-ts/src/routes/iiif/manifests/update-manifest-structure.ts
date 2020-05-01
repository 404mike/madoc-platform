import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';

export const updateManifestStructure: RouteMiddleware<{ id: number }, { structures: number[] }> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const collectionId = context.params.id;
  const userId = `urn:madoc:user:${jwt.user.id}`;
  const manifestIds = context.requestBody.structures;

  // site_id integer, collection_id integer, manifest_ids integer[], added_by text
  await context.connection.any(
    sql`select * from add_canvases_to_manifest(${siteId}, ${collectionId}, ${sql.array(
      manifestIds,
      sql`int[]`
    )}, ${userId})`
  );

  context.response.status = 200;
};
