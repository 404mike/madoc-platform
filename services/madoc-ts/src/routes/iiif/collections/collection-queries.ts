import { sql } from 'slonik';
import { metadataReducer } from '../../../utility/iiif-metadata';


type CollectionSnippetsRow = {
  collection_id: number;
  manifest_id: number;
  metadata_id: number;
  is_manifest: boolean;
  manifest_thumbnail: string | null;
  key: string;
  value: string;
  language: string;
  source: string;
  resource_id: number;
  canvas_count?: number;
};

export function getCollectionSnippets({
  collectionCount = 5,
  manifestCount = 5,
  manifestOffset = 0,
  siteId,
  sitePostgresId = `site_${siteId}`,
  collectionOffset = 0,
  fields,
  collectionId,
  allCollectionFields,
}: {
  siteId: number;
  sitePostgresId?: string;
  collectionCount?: number;
  collectionOffset?: number;
  manifestCount?: number;
  manifestOffset?: number;
  collectionId?: number;
  fields?: string[];
  allCollectionFields?: boolean;
}) {
  return sql<CollectionSnippetsRow>`
        select
            collections_aggregation.collection_id as collection_id,
            collections_aggregation.manifest_id as manifest_id,
            (collections_aggregation.manifest_id = metadata.resource_id) as is_manifest,
            collections_aggregation.manifest_thumbnail as thumbnail,
            collections_aggregation.manifest_canvas_count as canvas_count,
            metadata.id as metadata_id,
            metadata.key,
            metadata.value,
            metadata.language,
            metadata.source,
            metadata.resource_id
        from (
                 select *, collection.resource_id as collection_id
                 from (
                     ${
                       typeof collectionId !== 'undefined'
                         ? sql`select ${collectionId}::int as resource_id`
                         : sql`select filteredCollection.resource_id
                                from iiif_derivative filteredCollection
                                where filteredCollection.type = 'collection'
                                  and filteredCollection.context <@ ${sitePostgresId}
                                limit ${collectionCount} offset ${collectionOffset}`
                     }  
                          -- First we need to find the collections we want to query. Here you can set a limit.
                          -- context/type are indexed, so this should be quite a quick query.
                      ) collection
                          left join (

                     -- We join onto the manifests, counting the canvases that share a context.
                     select distinct manifest.context as manifest_context,
                                     manifest.resource_id as manifest_id,
                                     manifest_thumbnail(1, manifest.resource_id) as manifest_thumbnail,
                                     count(canvas.id) as manifest_canvas_count
                     from (
                         -- We pre-filter the manifests we are selecting from.
                         select innerManifest.id, innerManifest.context, innerManifest.resource_id
                          from iiif_derivative innerManifest
                          where innerManifest.type = 'manifest'
                            and innerManifest.context <@ 'site_1.collection_1'
                          order by innerManifest.resource_index limit ${manifestCount} offset ${manifestOffset}
                     ) manifest
                              left join iiif_derivative canvas on canvas.context <@ (${`${sitePostgresId}.manifest_`} || manifest.resource_id)::ltree
                     group by (manifest.id, manifest.context, manifest.resource_id, canvas.id)

                     -- We join on the context of the collection. The amount of collections per page is likely to be small.
                 ) t on t.manifest_context <@ (${`${sitePostgresId}.collection_`}  || collection.resource_id)::ltree
             ) collections_aggregation
                 -- With this aggregation of data, we can join all of these onto the metadata table
                 left join iiif_metadata metadata
                           on collections_aggregation.collection_id = metadata.resource_id or
                              collections_aggregation.manifest_id = metadata.resource_id
        where metadata.site_id = ${siteId}
          -- The metadata key can also be filtered here too.
          -- and metadata.key = ANY (array['label'])
          ${fields && !allCollectionFields ? sql`and metadata.key = ANY (${sql.array(fields, 'text')})` : sql``} 
          ${
            fields && allCollectionFields
              ? sql`and (
                      (collections_aggregation.manifest_id = metadata.resource_id) = false 
                        or metadata.key = ANY (${sql.array(fields, 'text')})
                      )`
              : sql``
          }
        ;
    `;
}

export function collectionAutocomplete({
  siteId,
  query,
  field = 'label',
  results = 10,
  language,
}: {
  siteId: number;
  query: string;
  language?: string;
  field?: string;
  results?: number;
}) {
  return sql<{ resource_id: number; value: string }>`
    select distinct im.resource_id, im.value
    from iiif_derivative
             left join iiif_metadata im on iiif_derivative.resource_id = im.resource_id
    where type = 'collection'
      and context <@ ${`site_${siteId}`}
      and im.key = ${field} 
      ${language ? sql`and im.language = ${language}` : sql``}
      and im.value ilike ${`${query}%`} 
    limit ${results}
  `;
}

export function mapCollectionSnippets(rows: CollectionSnippetsRow[]) {
  return rows.reduce(
    (state, row) => {
      if (state.metadata_ids.indexOf(row.metadata_id) !== -1) {
        return state;
      }

      state.metadata_ids.push(row.metadata_id);

      if (row.is_manifest) {
        if (!state.collection_to_manifest[row.collection_id]) {
          state.collection_to_manifest[row.collection_id] = [];
        }
        if (state.collection_to_manifest[row.collection_id].indexOf(row.manifest_id) === -1) {
          state.collection_to_manifest[row.collection_id].push(row.manifest_id);
        }

        const manifests = metadataReducer(state.manifests, row);

        // Add any extra rows.
        manifests[row.resource_id].canvasCount = row.canvas_count || 0;

        return {
          collection_to_manifest: state.collection_to_manifest,
          manifests,
          collections: state.collections,
          metadata_ids: state.metadata_ids,
        };
      }

      return {
        collection_to_manifest: state.collection_to_manifest,
        manifests: state.manifests,
        collections: metadataReducer(state.collections, row),
        metadata_ids: state.metadata_ids,
      };
    },
    {
      collections: {},
      manifests: {},
      collection_to_manifest: {},
      metadata_ids: [],
    } as {
      collections: any;
      manifests: any;
      collection_to_manifest: any;
      metadata_ids: number[];
    }
  );
}
