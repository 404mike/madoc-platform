import { UniversalRoute } from '../types';
import { Homepage } from './pages/homepage';
import { ManageCollections } from './pages/content/manage-collections';
import { SingleCollection } from './pages/content/single-collection';
import { ImportCollection } from './pages/content/import-collection';
import { CreateCollection } from './pages/content/create-collection';
import { CollectionList } from './pages/content/collections/collection-list';

export const routes: UniversalRoute[] = [
  {
    path: '/',
    exact: true,
    component: Homepage,
  },
  {
    path: '/collections',
    exact: true,
    component: ManageCollections,
  },
  {
    path: '/collections/:collectionId',
    component: SingleCollection,
  },
  {
    path: '/import-collection',
    exact: true,
    component: ImportCollection,
  },
  {
    path: '/create-collection',
    exact: true,
    component: CreateCollection,
  },
  {
    path: '/beta/collections',
    exact: true,
    component: CollectionList,
  },
];
