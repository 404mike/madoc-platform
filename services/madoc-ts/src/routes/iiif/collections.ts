// Create
// Update metadata
// Update structure
// Remove
// Read
// List

import { RouteMiddleware } from '../../types';
import { sql } from 'slonik';
import immer from 'immer';
import { InternationalString } from '@hyperion-framework/types';

type CreateCollectionRequest = {
  // Creator.
};
type UpdateCollectionMetadataRequest = {};
type UpdateCollectionStructure = {};
type ReadCollectionResponse = {};
type ListCollectionsResponse = {};

// POST /api/madoc/iiif/collection
export const createCollection: RouteMiddleware<{}, CreateCollectionRequest> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const userId = `urn:madoc:user:${jwt.user.id}`;
  const json = JSON.stringify(context.requestBody);

  // collection json, sid integer, extra_context text, added_by text
  const result = await context.connection.one<{ create_collection: string }>(
    sql`select create_collection(${json}, ${siteId}, null, ${userId})`
  );

  const res = result.create_collection.match(/\((\d+),(\d+)\)/);
  if (res) {
    const [, canonicalId, derivedId] = res;
    context.response.body = { canonicalId: Number(canonicalId), derivedId: Number(derivedId) };
  }

  context.response.status = 201;
};

export const getCollection: RouteMiddleware<{ collectionId: number }> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const collectionId = context.params.collectionId;
  const siteCtx = `site_${siteId}`;

  const collection = await context.connection.many<{
    resource_id: number;
    created_at: Date;
    key: string;
    value: string;
    language: string;
    source: string;
  }>(
    sql`select 
            ifd.resource_id, 
            ifd.created_at, 
            im.key, 
            im.value, 
            im.language, 
            im.source 
        from iiif_derivative ifd
        left join  iiif_metadata im 
            on ifd.resource_id = im.resource_id 
        where context <@ ${siteCtx} 
            and ifd.resource_id=${collectionId}
            and im.site_id=${jwt.site.id}
        `
  );

  // @todo add manifests proper fields.
  const manifests = await context.connection.many<any>(
    sql`select * from iiif_derivative where context <@ ${`${siteCtx}.collection_${collectionId}`} order by resource_index`
  );

  // This is very simple at the moment.
  const metadata = collection.reduce<any>((doc, field) => {
    if (!doc[field.key]) {
      doc[field.key] = {};
    }
    if (!doc[field.key][field.language]) {
      doc[field.key][field.language] = [];
    }
    doc[field.key][field.language].push(field.value);
    return doc;
  }, {});

  context.response.body = {
    id: collection[0].resource_id,
    source: collection[0].source,
    metadata,
    manifests,
  };
};

export const listCollections: RouteMiddleware = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const siteCtx = `site_${siteId}`;

  // @todo search by label for auto-complete

  const collections = await context.connection.many<{
    resource_id: number;
    created_at: Date;
    key: string;
    value: string;
    language: string;
    source: string;
  }>(
    sql`select 
            ifd.resource_id, 
            ifd.created_at, 
            im.key, 
            im.value, 
            im.language, 
            im.source 
        from iiif_derivative ifd
        left join  iiif_metadata im 
            on ifd.resource_id = im.resource_id 
        where context <@ ${siteCtx} 
            and im.site_id=${jwt.site.id}
            and im.key = 'label'
    `
  );

  context.response.body = Object.values(
    collections.reduce<any>((docs, item) => {
      if (!docs[item.resource_id]) {
        docs[item.resource_id] = {
          id: item.resource_id,
          source: item.source,
          metadata: {},
        };
      }

      if (!docs[item.resource_id].metadata[item.key]) {
        docs[item.resource_id].metadata[item.key] = {};
      }

      if (!docs[item.resource_id].metadata[item.key][item.language]) {
        docs[item.resource_id].metadata[item.key][item.language] = [];
      }

      docs[item.resource_id].metadata[item.key][item.language].push(item.value);
      return docs;
    }, {})
  );
};

export const getCollectionMetadata: RouteMiddleware<{ collectionId: number }> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const siteCtx = `site_${siteId}`;
  const collectionId = context.params.collectionId;

  const collection = await context.connection.many<{
    key: string;
    value: string;
    language: string;
    source: string;
    edited: boolean;
    auto_update: boolean;
    readonly: boolean;
    data: any;
  }>(
    sql`select 
            im.id,
            im.key, 
            im.value, 
            im.language, 
            im.source,
            im.edited,
            im.auto_update,
            im.readonly,
            im.data
        from iiif_derivative ifd
        left join  iiif_metadata im 
            on ifd.resource_id = im.resource_id 
        where context <@ ${siteCtx} 
            and ifd.resource_id=${collectionId}
            and im.site_id=${jwt.site.id}
        `
  );

  context.response.body = {
    fields: collection,
  };
};

/**
 * @todo when manifests exist.
 * @param context
 */
export const getCollectionStructure: RouteMiddleware<{ collectionId: number }> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const collectionId = context.params.collectionId;
  const ctx = `site_${siteId}.collection_${collectionId}`;

  const manifests = await context.connection.any<any>(sql`
    select * from iiif_derivative where context ~ ${ctx} 
  `);

  context.response.body = { manifests };
};

export const updateCollectionStructure: RouteMiddleware<
  { collectionId: number },
  { structures: number[] }
> = async context => {
  // @todo when manifests exist.

  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const collectionId = context.params.collectionId;
  const userId = `urn:madoc:user:${jwt.user.id}`;
  const manifestIds = context.requestBody.structures;

  // site_id integer, collection_id integer, manifest_ids integer[], added_by text
  await context.connection.any(
    sql`select * from add_manifests_to_collection(${siteId}, ${collectionId}, ${sql.array(
      manifestIds,
      sql`int[]`
    )}, ${userId})`
  );

  context.response.status = 200;
};

export const updateCollectionMetadata: RouteMiddleware = async context => {
  // @todo abstraction over metadata updating.
};

export const deleteCollection: RouteMiddleware<{ collectionId: number }> = async context => {
  // @todo delete collection.
};
