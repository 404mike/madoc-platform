import { TypedRouter } from './utility/typed-router';
import { ping } from './routes/ping';
import { omekaHelloWorld } from './routes/omeka-hello-world';
import { madocNotFound } from './routes/madoc-not-found';
import { keys } from './routes/keys';
import { importCollection, importManifest } from './routes/iiif-import/import';
import { loginPage } from './routes/user/login';
import { getSiteScopes, saveSiteScopes } from './routes/admin/site-scopes';
import { logout } from './routes/user/logout';
import { getReactPage } from './routes/iiif-import/react-testing';
import { frontendBundles } from './routes/assets/frontend-bundles';
import { adminFrontend } from './routes/admin/frontend';
import { listCollections } from './routes/iiif/list-collections';
import { getCollection } from './routes/iiif/get-collection';
import { createCollection } from './routes/iiif/create-collection';
import * as collections from './routes/iiif/collections';
import * as manifests from './routes/iiif/manifests';

export const router = new TypedRouter({
  // Normal route
  'get-ping': [TypedRouter.GET, '/api/madoc', ping],
  'import-manifest': [TypedRouter.POST, '/api/madoc/iiif/manifest', importManifest],
  'import-collection': [TypedRouter.POST, '/api/madoc/iiif/collection', importCollection],
  'get-scopes': [TypedRouter.GET, '/api/madoc/site/:siteId/permissions', getSiteScopes],
  'update-scopes': [TypedRouter.POST, '/api/madoc/site/:siteId/permissions', saveSiteScopes],

  // New beta routes.
  'beta-create-collection': [TypedRouter.POST, '/api/madoc/beta/iiif/collections', collections.createCollection],
  'beta-get-collection': [TypedRouter.GET, '/api/madoc/beta/iiif/collections/:collectionId', collections.getCollection],
  'beta-list-collections': [TypedRouter.GET, '/api/madoc/beta/iiif/collections', collections.listCollections],
  'beta-update-collection-structure': [
    TypedRouter.PUT,
    '/api/madoc/beta/iiif/collections/:collectionId/structure',
    collections.updateCollectionStructure,
  ],
  'beta-get-collection-structure': [
    TypedRouter.GET,
    '/api/madoc/beta/iiif/collections/:collectionId/structure',
    collections.getCollectionStructure,
  ],
  'beta-get-collection-metadata': [
    TypedRouter.GET,
    '/api/madoc/beta/iiif/collections/:collectionId/metadata',
    collections.getCollectionMetadata,
  ],
  'beta-create-manifest': [TypedRouter.POST, '/api/madoc/beta/iiif/manifests', manifests.createManifest],
  'beta-get-manifest': [TypedRouter.GET, '/api/madoc/beta/iiif/manifests/:manifestId', manifests.getManifest],
  'beta-list-manifests': [TypedRouter.GET, '/api/madoc/beta/iiif/manifests', manifests.listManifests],
  'beta-get-manifest-metadata': [
    TypedRouter.GET,
    '/api/madoc/beta/iiif/manifests/:manifestId/metadata',
    manifests.getManifestMetadata,
  ],
  // Collections
  'create-collection': [TypedRouter.POST, '/api/madoc/iiif/collections', createCollection],
  'get-collections': [TypedRouter.GET, '/api/madoc/iiif/collections', listCollections],
  'get-collection': [TypedRouter.GET, '/api/madoc/iiif/collection/:collectionId', getCollection],

  // Omeka routes
  'omeka-test': [TypedRouter.GET, '/s/:slug/madoc/hello-world', omekaHelloWorld],
  'get-keys': [TypedRouter.GET, '/s/:slug/madoc/test-key', keys],
  'get-login': [TypedRouter.GET, '/s/:slug/madoc/login', loginPage],
  'post-login': [TypedRouter.POST, '/s/:slug/madoc/login', loginPage],
  'get-logout': [TypedRouter.GET, '/s/:slug/madoc/logout', logout],
  'assets-bundles': [TypedRouter.GET, '/s/:slug/madoc/assets/:bundleId/bundle.js', frontendBundles],

  // React test.
  'react-2': [TypedRouter.GET, '/s/:slug/madoc/react-2', getReactPage],
  'admin-frontend': [TypedRouter.GET, '/s/:slug/madoc/admin*', adminFrontend],

  // Make sure this is last.
  'omeka-404': [TypedRouter.GET, '/s/:slug/madoc*', madocNotFound],
});
