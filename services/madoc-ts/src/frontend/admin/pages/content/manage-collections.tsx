import { UniversalComponent } from '../../../types';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const ManageCollections: UniversalComponent<
  { collections: any[]; page: number; nextPage: boolean },
  { collectionId?: string },
  { page: number }
> = ({ collections, nextPage, page }) => {
  const location = useLocation();

  return (
    <div>
      <ul>
        {collections.map((collection, key) => (
          <li key={key}>
            <Link to={`/collections/${collection.id}`}>{collection.label}</Link> - {collection.manifest_count} (
            {collection.id})
            {collection.manifests.map((m: any) => (
              <div key={m.manifest_id}>
                {m.manifest_label}
                <img src={m.thumbnail} height={100} />
              </div>
            ))}
          </li>
        ))}
        {page > 0 ? <Link to={`${location.pathname}${page > 1 ? `?page=${page - 1}` : ''}`}>Previous page</Link> : null}
        {nextPage ? <Link to={`${location.pathname}?page=${page + 1}`}>Next page</Link> : null}
      </ul>
    </div>
  );
};

ManageCollections.getData = async (params, api, query) => {
  const { collections, page, nextPage } = await api.getCollections(query.page);
  return {
    collections,
    page,
    nextPage,
  };
};

export { ManageCollections };
