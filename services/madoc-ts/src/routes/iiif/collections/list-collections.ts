import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';
import { CollectionListResponse } from '../../../schemas/collection-list';
import { getCollectionSnippets, mapCollectionSnippets } from './collection-queries';

export const listCollections: RouteMiddleware<{ page: number }> = async context => {
  const { siteId, sitePostgresId } = userWithScope(context, []);

  const collectionCount = 5;
  const manifestCount = 5;
  const page = Number(context.query.page) || 1;
  const offset = (page - 1) * collectionCount;
  const { total = 0 } = await context.connection.one<{ total: number }>(sql`
      select count(id) as total
          from iiif_derivative
          where type = 'collection' 
          and context <@ ${sitePostgresId}
  `);
  const totalPages = Math.ceil(total / collectionCount);

  const rows = await context.connection.many(
    getCollectionSnippets({
      siteId: Number(siteId),
      fields: ['label'],
      manifestCount,
      collectionCount,
      collectionOffset: offset,
    })
  );

  const table = mapCollectionSnippets(rows);

  const collectionsIds = Object.keys(table.collections);

  // Not ideal being it's own query.
  const totals = await context.connection.any<{ context: string; total: number }>(sql`
      select context, count(id) as total
        from iiif_derivative
        where type = 'manifest' 
        and context <@ 
            ${sql.array(
              collectionsIds.map(id => `${sitePostgresId}.collection_${id}`),
              'ltree' as any
            )} group by context
    `);

  const totalsIdMap = totals.reduce((state, row) => {
    const found = row.context.match(/\.collection_(\d+)/);
    if (found) {
      const [, id] = found;
      state[id] = row.total;
    }
    return state;
  }, {} as { [id: string]: number });

  const returnCollections = [];
  for (const collectionId of collectionsIds) {
    const collection = table.collections[collectionId];
    const manifestIds = table.collection_to_manifest[collectionId] || [];
    collection.manifestCount = totalsIdMap[collectionId] || 0;
    collection.items = manifestIds.map((id: number) => table.manifests[id]);
    returnCollections.push(collection);
  }

  context.response.body = {
    collections: returnCollections,
    pagination: {
      page,
      totalResults: total,
      totalPages,
    },
  } as CollectionListResponse;
};
