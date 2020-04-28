import { RouteMiddleware } from '../../types';

export const listCollections: RouteMiddleware<{ slug: string; page: number }> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.status = 404;
    return;
  }

  context.response.body = await context.omeka.getTransaction(async connection => {
    const page = Number(context.query.page || 0);

    // 1. Get collections.
    const { collections, nextPage } = await context.omeka.getCollections(page, jwt.site.id);

    const collectionList = await Promise.all(
      collections.map(collection => {
        return new Promise(resolve => {
          context.omeka
            .getManifestSnippetsByCollectionId(collection.id, { perPage: 5, page: 0 }, connection)
            .then(manifests => {
              resolve({
                ...collection,
                manifests,
              });
            });
        });
      })
    );

    return {
      collections: collectionList,
      page,
      nextPage,
    };
  });

  context.response.status = 200;
};