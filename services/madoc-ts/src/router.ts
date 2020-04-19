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
import {getCollection} from './routes/iiif/get-collection';

export const router = new TypedRouter({
  // Normal route
  'get-ping': [TypedRouter.GET, '/api/madoc', ping],
  'import-manifest': [TypedRouter.POST, '/api/madoc/iiif/manifest', importManifest],
  'import-collection': [TypedRouter.POST, '/api/madoc/iiif/collection', importCollection],
  'get-scopes': [TypedRouter.GET, '/api/madoc/site/:siteId/permissions', getSiteScopes],
  'update-scopes': [TypedRouter.POST, '/api/madoc/site/:siteId/permissions', saveSiteScopes],
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
