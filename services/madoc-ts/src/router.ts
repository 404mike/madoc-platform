import { TypedRouter } from './utility/typed-router';
import { ping } from './routes/ping';
import { omekaHelloWorld } from './routes/omeka-hello-world';
import { madocNotFound } from './routes/madoc-not-found';
import { importCollection, importManifest } from './routes/iiif-import/import';
import { loginPage } from './routes/user/login';
import { getSiteScopes, saveSiteScopes } from './routes/admin/site-scopes';
import { logout } from './routes/user/logout';
import { getReactPage } from './routes/iiif-import/react-testing';
import { frontendBundles } from './routes/assets/frontend-bundles';
import { adminFrontend } from './routes/admin/frontend';
import { createCollection } from './routes/iiif/collections/create-collection';
import { deleteCollection } from './routes/iiif/collections/delete-collection';
import { getCollection } from './routes/iiif/collections/get-collection';
import { getCollectionStructure } from './routes/iiif/collections/get-collection-structure';
import { getCollectionMetadata } from './routes/iiif/collections/get-collection-metadata';
import { listCollections } from './routes/iiif/collections/list-collections';
import { updateCollectionMetadata } from './routes/iiif/collections/update-collection-metadata';
import { updateCollectionStructure } from './routes/iiif/collections/update-collection-structure';
import { listManifests } from './routes/iiif/manifests/list-manifests';
import { createManifest } from './routes/iiif/manifests/create-manifest';
import { getManifest } from './routes/iiif/manifests/get-manifest';
import { deleteManifest } from './routes/iiif/manifests/delete-manifest';
import { getManifestMetadata } from './routes/iiif/manifests/get-manifest-metadata';
import { listCanvases } from './routes/iiif/canvases/list-canvases';
import { createCanvas } from './routes/iiif/canvases/create-canvas';
import { getCanvas } from './routes/iiif/canvases/get-canvas';
import { getCanvasMetadata } from './routes/iiif/canvases/get-canvas-metadata';
import { updateManifestStructure } from './routes/iiif/manifests/update-manifest-structure';
import { getManifestStructure } from './routes/iiif/manifests/get-manifest-structure';
import { getLocale } from './routes/locales';

export const router = new TypedRouter({
  // Normal route
  'get-ping': [TypedRouter.GET, '/api/madoc', ping],
  'import-manifest': [TypedRouter.POST, '/api/madoc/iiif/manifest', importManifest],
  'import-collection': [TypedRouter.POST, '/api/madoc/iiif/collection', importCollection],
  'get-scopes': [TypedRouter.GET, '/api/madoc/site/:siteId/permissions', getSiteScopes],
  'update-scopes': [TypedRouter.POST, '/api/madoc/site/:siteId/permissions', saveSiteScopes],

  // Locale
  'get-locale': [TypedRouter.GET, '/api/madoc/locales/:lng/:ns', getLocale],

  // Collection API.
  'list-collections': [TypedRouter.GET, '/api/madoc/iiif/collections', listCollections],
  'get-collection': [TypedRouter.GET, '/api/madoc/iiif/collections/:id', getCollection],
  'create-collection': [TypedRouter.POST, '/api/madoc/iiif/collections', createCollection, 'CreateCollection'],
  'delete-collection': [TypedRouter.DELETE, '/api/madoc/iiif/collections/:id', deleteCollection],
  'get-collection-metadata': [TypedRouter.GET, '/api/madoc/iiif/collections/:id/metadata', getCollectionMetadata],
  'get-collection-structure': [TypedRouter.GET, '/api/madoc/iiif/collections/:id/structure', getCollectionStructure],
  'put-collection-metadata': [TypedRouter.PUT, '/api/madoc/iiif/collections/:id/metadata', updateCollectionMetadata],
  'put-collection-structure': [TypedRouter.PUT, '/api/madoc/iiif/collections/:id/structure', updateCollectionStructure],

  // Manifest API.
  'list-manifests': [TypedRouter.GET, '/api/madoc/iiif/manifests', listManifests],
  'get-manifest': [TypedRouter.GET, '/api/madoc/iiif/manifests/:id', getManifest],
  'create-manifest': [TypedRouter.POST, '/api/madoc/iiif/manifests', createManifest, 'CreateManifest'],
  'delete-manifest': [TypedRouter.DELETE, '/api/madoc/iiif/manifests/:id', deleteManifest],
  'get-manifest-metadata': [TypedRouter.GET, '/api/madoc/iiif/manifests/:id/metadata', getManifestMetadata],
  'get-manifest-structure': [TypedRouter.GET, '/api/madoc/iiif/manifests/:id/structure', getManifestStructure],
  // 'put-manifest-metadata': [TypedRouter.PUT, '/api/madoc/iiif/manifests/:id/metadata', updateManifestMetadata],
  'put-manifest-structure': [TypedRouter.PUT, '/api/madoc/iiif/manifests/:id/structure', updateManifestStructure],

  // Canvas API
  'list-canvases': [TypedRouter.GET, '/api/madoc/iiif/canvases', listCanvases],
  'get-canvas': [TypedRouter.GET, '/api/madoc/iiif/canvases/:id', getCanvas],
  'create-canvas': [TypedRouter.POST, '/api/madoc/iiif/canvases', createCanvas],
  'get-canvas-metadata': [TypedRouter.GET, '/api/madoc/iiif/canvases/:id/metadata', getCanvasMetadata],
  // 'put-canvas-metadata': [TypedRouter.PUT, '/api/madoc/iiif/canvases/:id/metadata', updateCanvasMetadata],

  // Omeka routes
  'omeka-test': [TypedRouter.GET, '/s/:slug/madoc/hello-world', omekaHelloWorld],
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
