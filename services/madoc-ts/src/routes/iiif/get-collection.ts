// Return collection and paginated list of manifests
import { RouteMiddleware } from '../../types';

export const getCollection: RouteMiddleware<{ collectionId: number }> = async context => {
  const collectionId = Number(context.params.collectionId);
  const page = Number(context.query.page) || 0;

  context.response.body = {
    collection: await context.omeka.getCollectionById(collectionId),
    manifests: await context.omeka.getManifestSnippetsByCollectionId(collectionId, {
      page: page,
      perPage: 20,
    }),
    page,
    perPage: 20,
  };
};
