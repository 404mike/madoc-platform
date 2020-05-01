import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';
import { getCollectionSnippets, mapCollectionSnippets } from './collection-queries';
import { CollectionFull } from '../../../schemas/collection-full';

export const getCollection: RouteMiddleware<{ id: number }> = async context => {
  const { siteId, sitePostgresId } = userWithScope(context, []);
  const collectionId = context.params.id;

  const manifestsPerPage = 24;
  const { total = 0 } = (await context.connection.maybeOne<{ total: number }>(sql`
      select count(id) as total
          from iiif_derivative
          where type = 'manifest' 
          and context <@ ${`${sitePostgresId}.collection_${collectionId}`}
  `)) || { total: 0 };
  const totalPages = Math.ceil(total / manifestsPerPage) || 1;
  const requestedPage = Number(context.query.page) || 1;
  const page = requestedPage < totalPages ? requestedPage : totalPages;
  const offset = (page - 1) * manifestsPerPage;

  const rows = await context.connection.many(
    getCollectionSnippets({
      collectionId,
      siteId: Number(siteId),
      fields: ['label'],
      allCollectionFields: true,
      manifestCount: manifestsPerPage,
      manifestOffset: offset,
    })
  );

  const table = mapCollectionSnippets(rows);

  const returnCollections = [];
  const collection = table.collections[`${collectionId}`];
  const manifestIds = table.collection_to_manifest[`${collectionId}`] || [];
  collection.items = manifestIds.map((id: number) => table.manifests[id]);
  returnCollections.push(collection);

  context.response.body = {
    collection,
    pagination: {
      page,
      totalResults: total,
      totalPages,
    },
  } as CollectionFull;
};
