import React from 'react';
import { UniversalComponent } from '../../../../types';
import { useQuery } from 'react-query';
import { useApi } from '../../../index';

export const CollectionList: UniversalComponent<{}> = () => {
  const api = useApi();

  const collections = useQuery('collections', async () => {
    return api.request<any>('/api/madoc/beta/iiif/collections');
  });

  if (collections.status !== 'success') {
    return <div>Loading...</div>;
  }

  return (
    <>
      <h3>Collection list</h3>
      <ul>
        {collections.data.map((collection: any) => <li>{collection.id}</li>)}
      </ul>
    </>
  );
};

CollectionList.getData = async () => ({});
