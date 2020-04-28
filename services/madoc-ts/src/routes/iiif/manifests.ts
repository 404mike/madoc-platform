import { RouteMiddleware } from '../../types';
import { sql } from 'slonik';
import { ManifestNormalized } from '@hyperion-framework/types';

type CreateManifestRequest = {
  local_source?: string;
  manifest: ManifestNormalized;
};

// @todo create manifest via source, check if already exists and just derive it if it does.
// @todo fix bug with create_manifest where multiple derived are inserted - probably missing index.
export const createManifest: RouteMiddleware<{}, CreateManifestRequest> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const userId = `urn:madoc:user:${jwt.user.id}`;
  const manifestJson = JSON.stringify(context.requestBody.manifest);
  const localSource = context.requestBody.local_source;

  const response = await context.connection.one<{ derived_id: number; canonical_id: number }>(
    sql`select * from create_manifest(${manifestJson}, ${localSource ? localSource : null}, ${siteId}, null, ${userId})`
  );

  context.response.body = response;
};

export const getManifest: RouteMiddleware<{ manifestId: string }> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const manifestId = context.params.manifestId;

  const ctx = `site_${siteId}`;

  const manifests = await context.connection.many<{
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
            im.source from iiif_derivative ifd
        left outer join iiif_metadata im on ifd.resource_id = im.resource_id
    where context ~ ${ctx}
    and ifd.resource_id = ${manifestId}
    and ifd.type = 'manifest'
    and im.site_id = ${siteId}
    group by ifd.resource_id, ifd.created_at, im.key, im.value, im.language, im.source
  `
  ); // @todo come back to group by for multiple scopes.

  console.log(manifests);

  context.response.body = Object.values(
    manifests.reduce<any>((acc, next) => {
      if (!acc[next.resource_id]) {
        acc[next.resource_id] = {
          id: next.resource_id,
          created: next.created_at,
        };
      }
      let property = acc[next.resource_id];
      // @ts-ignore
      // eslint-disable-next-line eqeqeq
      const properties = next.key.split('.').map(r => (r == Number(r) ? Number(r) : r));
      for (let i = 0; i < properties.length; i++) {
        if (!property[properties[i]]) {
          if (typeof properties[i + 1] !== 'undefined') {
            if (typeof properties[i + 1] === 'number') {
              property[properties[i]] = [];
            } else {
              property[properties[i]] = {};
            }
          } else {
            property[properties[i]] = {};
          }
        }
        property = property[properties[i]];
      }

      if (!property[next.language]) {
        property[next.language] = [];
      }

      property[next.language].push(next.value);

      return acc;
    }, {})
  )[0];
};

export const listManifests: RouteMiddleware = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;

  const ctx = `site_${siteId}`;

  const manifests = await context.connection.many<{
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
            im.source from iiif_derivative ifd
        left outer join iiif_metadata im on ifd.resource_id = im.resource_id
    where context ~ ${ctx}
    and ifd.type = 'manifest'
    and im.key = 'label'
    and im.site_id = ${siteId}
    group by ifd.resource_id, ifd.created_at, im.key, im.value, im.language, im.source
  `
  ); // @todo come back to group by for multiple scopes.

  context.response.body = Object.values(
    manifests.reduce<any>((acc, next) => {
      if (!acc[next.resource_id]) {
        acc[next.resource_id] = {
          id: next.resource_id,
          created: next.created_at,
        };
      }
      let property = acc[next.resource_id];
      // @ts-ignore
      // eslint-disable-next-line eqeqeq
      const properties = next.key.split('.').map(r => (r == Number(r) ? Number(r) : r));
      for (let i = 0; i < properties.length; i++) {
        if (!property[properties[i]]) {
          if (typeof properties[i + 1] !== 'undefined') {
            if (typeof properties[i + 1] === 'number') {
              property[properties[i]] = [];
            } else {
              property[properties[i]] = {};
            }
          } else {
            property[properties[i]] = {};
          }
        }
        property = property[properties[i]];
      }

      if (!property[next.language]) {
        property[next.language] = [];
      }

      property[next.language].push(next.value);

      return acc;
    }, {})
  );
};
export const getManifestMetadata: RouteMiddleware<{ manifestId: string }> = async context => {
  const jwt = context.state.jwt;
  if (!jwt) {
    context.response.body = { error: 'Not found...' };
    return;
  }

  const siteId = jwt.site.id;
  const siteCtx = `site_${siteId}`;
  const manifestId = context.params.manifestId;

  const manifest = await context.connection.many<{
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
            and ifd.resource_id=${manifestId}
            and im.site_id=${jwt.site.id}
        `
  );

  context.response.body = {
    fields: manifest,
  };
};
export const getManifestStructure: RouteMiddleware = async context => {};
export const updateManifestMetadata: RouteMiddleware = async context => {};
export const updateManifestStructure: RouteMiddleware = async context => {};
export const deleteManifest: RouteMiddleware = async context => {};
