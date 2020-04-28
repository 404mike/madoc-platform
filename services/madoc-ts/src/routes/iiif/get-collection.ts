// Return collection and paginated list of manifests
import { RouteMiddleware } from '../../types';

export const getCollection: RouteMiddleware<{ collectionId: number }> = async context => {
  if (!context.state.jwt) {
    return;
  }
  const collectionId = Number(context.params.collectionId);
  const page = Number(context.query.page) || 0;

  const collection = await context.omeka.getCollectionById(collectionId, context.state.jwt.site.id);

  if (!collection) {
    return;
  }

  context.response.body = {
    collection,
    manifests: await context.omeka.getManifestSnippetsByCollectionId(collectionId, {
      page: page,
      perPage: 20,
    }),
    page,
    perPage: 20,
  };
};
