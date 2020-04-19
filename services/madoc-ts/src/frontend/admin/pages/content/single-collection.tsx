import { UniversalComponent } from '../../../types';
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export const SingleCollection: UniversalComponent<
  {
    collection: { id: number; label: string; manifest_count: number };
    manifests: Array<{
      manifest_id: number;
      manifest_label: string;
      canvas_id: number;
      thumbnail: string;
    }>;
    page: number;
    perPage: number;
  },
  { collectionId: number },
  { page?: number }
> = ({ collection, manifests, page, perPage }) => {
  const location = useLocation();
  const nextPage = perPage * page < collection.manifest_count;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    <div>
      <h1>{collection.label}</h1>
      {page > 0 ? <Link to={`${location.pathname}${page > 1 ? `?page=${page - 1}` : ''}`}>Previous page</Link> : null}
      {nextPage ? <Link to={`${location.pathname}?page=${page + 1}`}>Next page</Link> : null}
      <p>{collection.id}</p>
      <p>{collection.manifest_count} images</p>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {manifests.map((manifest, key) => (
          <div key={manifest.manifest_id} style={{ width: '25%' }}>
            <img src={manifest.thumbnail} width="100%" height="auto" />
            <h4>{manifest.manifest_label}</h4>
          </div>
        ))}
      </div>
      {page > 0 ? <Link to={`${location.pathname}${page > 1 ? `?page=${page - 1}` : ''}`}>Previous page</Link> : null}
      {nextPage ? <Link to={`${location.pathname}?page=${page + 1}`}>Next page</Link> : null}
    </div>
  );
};

SingleCollection.getData = (params, api, queryString) => {
  return api.getCollectionById(params.collectionId, queryString.page || 0);
};
