import { UniversalRoute } from '../types';
import { Homepage } from './pages/homepage';
import { CollectionView } from './pages/content/collections/collection';
import { CollectionList } from './pages/content/collections/collection-list';
import { EditCollectionStructure } from './pages/content/collections/edit-collection-structure';
import { EditCollectionMetadata } from './pages/content/collections/edit-collection-metadata';
import { DeleteCollection } from './pages/content/collections/delete-collection';
import { Manifest } from './pages/content/manifests/manifest';
import { CollectionImportManifest } from './pages/content/collections/collection-import-manifest';
import { CollectionImport } from './pages/content/collections/collection-import';

export const routes: UniversalRoute[] = [
  {
    path: '/',
    exact: true,
    component: Homepage,
  },
  {
    path: '/collections',
    exact: true,
    component: CollectionList,
  },
  {
    path: '/collections/:id',
    exact: true,
    component: CollectionView,
  },
  {
    path: '/collections/:id/structure',
    exact: true,
    component: EditCollectionStructure,
  },
  {
    path: '/collections/:id/metadata',
    exact: true,
    component: EditCollectionMetadata,
  },
  {
    path: '/collections/:id/delete',
    exact: true,
    component: DeleteCollection,
  },
  {
    path: '/collections/:id/import',
    exact: true,
    component: CollectionImportManifest,
  },
  {
    path: '/manifests/:id',
    exact: true,
    component: Manifest,
  },
  {
    path: '/import/collection',
    exact: true,
    component: CollectionImport,
  },
  // {
  //   path: '/collections/:collectionId',
  //   component: SingleCollection,
  // },
  // {
  //   path: '/import-collection',
  //   exact: true,
  //   component: ImportCollection,
  // },
  // {
  //   path: '/create-collection',
  //   exact: true,
  //   component: CreateCollection,
  // },
  // {
  //   path: '/beta/collections',
  //   exact: true,
  //   component: CollectionList,
  // },
];
