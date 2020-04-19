import { UniversalRoute } from '../types';
import { Homepage } from './pages/homepage';
import { ManageCollections } from './pages/content/manage-collections';
import { SingleCollection } from './pages/content/single-collection';

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
];
