/**
 * Importing and storing IIIF content and managing derivatives.
 *
 * - Store a verifiable, immutable resource in a global context, including structure (correct, not efficient)
 * - Store a representation of that resource under a given context (site)
 *     - Structure (manifest -> canvas)
 *     - Labelling
 *     - Other chosen metadata to be available
 * - The canonical resource can make available more sources of metadata over time
 *     - As more sources become available, the metadata made available on sites (to search, browser, contribute)
 *     - Metadata can be "published" back to the canonical resource – note our representation of this, which can be
 *        available for other sites to ingest and use. In this scenario, metadata spread across multiple sites could
 *        become out of date. Metadata can be marked as read-only, where updates to the canonical will also update
 *        the sites metadata.
 * - Metadata can be added under one of these contexts.
 *
 * Structure
 *
 *   - id
 *   - context
 *   - order
 *   - resource_id (omeka)
 *   - type
 *
 *
 *   Madoc site (1)
 *    - Collection (101)
 *      - Manifest A (201)
 *         - Canvas 1 (301)
 *         - Canvas 2 (302)
 *         - Canvas 3 (303)
 *
 * Structure table:
 *  0, [site_1],                               0, 101, collection
 *  1, [site_1, collection_101],               0, 201, manifest
 *  2, [site_1, collection_101, manfiest_201], 0, 301, canvas
 *  3, [site_1, collection_101, manfiest_201], 1, 302, canvas
 *  4, [site_1, collection_101, manfiest_201], 2, 303, canvas
 *
 * Metdata table:
 *
 * 0, label, Collection, en, -, -, 1, range
 * 1, label, Manifest A, en, -, -, 2, range
 * 2, label, Canvas 1,   en, -, -, 3, range
 * 3, label, Canvas 2,   en, -, -, 4, range
 * 4, label, Canvas 3,   en, -, -, 5, range
 *
 * To get collection manifests:
 *
 *    SELECT * FROM structure WHERE context = ['site_1', 'collection_101'] AND type = 'manifest' ORDER BY order
 *
 * To get manifest labels in collection
 *
 *    SELECT * FROM structure
 *    LEFT JOIN metadata on metadata.resource = structure.id
 *    WHERE structure.context = ['site_1', 'collection_101']
 *      AND structure.type = 'manifest'
 *      AND metadata.type = 'label' AND metadata.source = 'range'
 *    ORDER BY structure.order
 *
 * Find canvases labels in collection
 *
 *  SELECT * FROM structure
 *  LEFT JOIN metadata on metadata.resource = structure.id
 *  WHERE structure.context <@ ['site_1', 'collection_101']
 *    AND structure.type = 'canvas'
 *    AND metadata.type = 'label' AND metadata.source = 'range'
 *
 * -> Indexes could be created for collections.
 * -> Full-text search on the metadata could be done.
 * -> Different sources of metadata could be aggregated to different parts of the resource
 * -> Whenever a resource is assigned to a site, all of the metadata is ported over
 * -> The original resource remains intact
 * -> Could be expanded with slugs on resources to drive navigation
 * -> Allows for exact or fuzzy searching through contexts
 * -> Joining back to the metadata table can power some search scenarios
 * -> The metadata index itself can be used to drive full-search
 * -> Capture models results can be "exported" into the metadata index
 * -> Index can be turned into a tree and exported to Elasticsearch
 * -> Initial indexes can be for the structure types and metadata sources
 *
 *
 * -> When fetching an Omeka page, we will still need a thumbnail
 *    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *
 *
 * Resources
 * These describe properties of a resource that DONT change, for example width, height, thumbnail of a resource. If they
 * are changed the changes _should_ be reflected on all items. Examples:
 *
 *   - Source
 *   - Thumbnail URL
 *   - Filesystem location of original JSON for building aggregations
 *   - attribution
 *   - license
 *   - width
 *   - height
 *   - type
 *   - items[]  - list of ids of other resources in the table – this is the canonical ordering of these items
 *
 * These will mirror some of the technical properties from the IIIF specification.
 *
 * Metadata
 *
 * This is an interim solution to avoid storing metadata directly inside of Omeka. This will avoid needing to reindex
 * it into a searchable index.
 *
 * The metadata table is fairly simple:
 *
 *          |---------------------------------------------------------------------------------|
 *          |  id   |  key  |  value  |  lang  |  fth     |  context  |  resource  |  source  |
 *          |---------------------------------------------------------------------------------|
 *   type   | int   | text  | text    | text   | tsvector | ltree     | text       | text     |
 *  serial  | yes   | -     | -       | -      | -        | -         | -          | -        |
 *          |---------------------------------------------------------------------------------|
 *
 * This table may be sourced from an ingest of a JSON document, or the outputs of crowdsourcing.
 *
 * The data here could be easily forward ingested into an elasticsearch to provide the same search
 * experience.
 *
 * At the most basic level, this offers simple faceting based on the metadata contained. The second
 * phase of this metadata store is to create indexes-on-demand, managed and stored in another table
 * to offer performance over certain sections of the metadata.
 *
 * ----------------------------------------------------------------------------------------------------------
 * Note on context
 *
 * In Madoc, the following format is used for contexts:
 *
 *   urn:madoc:manifest:1
 *      |     |        |^-- The id of the resource
 *      |     |^^^^^^^^----- The type of resource
 *       ^^^^^------------- The madoc namespace
 *
 * Due to limitations in the postgres ltree type, we cannot use `:` instead we use `_` The example above
 * would become
 *
 *   manifest_1
 *  |        |^-- The id of the resource
 *   ^^^^^^^^---- The type of resource
 *
 * The ID _may_ contain underscores, which will be ignored, but the resource types cannot use underscores.
 *
 * ----------------------------------------------------------------------------------------------------------
 * The basic operations:
 *
 * -> Get all IIIF metadata
 *
 *       SELECT key, value, lang FROM metadata WHERE source = 'iiif' AND resource = 'collection_123'
 *
 * -> Get all transcriptions on canvases for a manifest
 *
 *       SELECT value FROM metadata WHERE key = 'transcription' AND context <@ 'manifest_123'
 *
 * ----------------------------------------------------------------------------------------------------------
 * Notes:
 *
 * -> Since this table does not hold any contextual data, if the context of a resource changes, for example a
 *    manifest added to a collection, this table needs to update itself with that information.
 *
 * -> This will not scale infinitely. It is a safe place to store metadata in a simple format with some simple
 *    APIs to access the data back out.
 *
 * -> Only simple metadata. This will not hold relations to other documents or complex graph of data. This is
 *    primarily for textual content associated with other content.
 *
 * -> IIIF metadata will be split, given:
 *
 *       {
 *          "label": { "en": [ "Creator" ] },
 *          "value": { "en": [ "Anne Artist (1776-1824)" ] }
 *       }
 *
 *    The application will normalize the key in the default language:
 *
 *     key      | source | value                    | lang
 *    ----------|--------|--------------------------|------
 *     creator  | iiif   | Anne Artist (1776-1824)  | en
 *
 *     The label will, if it does not exist already, be stored in a second table for mapping
 *     keys to labels. This table will contain language, value and key but will not be ingested
 *     each time.
 *
 * -> RDF terms can be used as keys if desired - although this is simply a usage of the APIs and not something
 *    built into the system. You can either provide label/value pairs or key objects. Parsable input:
 *
 * -> Input variations:
 *
 *    { someField: 'some value' }
 *    { someField: { en: 'some value' } }
 *    { someField: { en: ['some value'] } }
 *    { someField: [{ label: 'Some field', value: 'some value' }] }
 *    { someField: [{ label: { en: 'Some field' }, value: { en: 'some value' }}] }
 *    { someField: [{ label: { en: ['Some field'] }, value: { en: ['some value'] }}] }
 *    [{ label: { en: ['Some field'] }, value: { en: ['some value'] }}]
 *
 *    Will all yield:
 *
 *     key        | value                    | lang
 *    ------------|--------------------------|------
 *     someField  | some value               | en
 *
 * ----------------------------------------------------------------------------------------------------------
 * Endpoints:
 *
 *
 * GET /api/metadata/manifest/123
 *
 * POST /api/metadata/manifest/123
 *  {
 *    "data": { ... }
 *  }
 *
 *
 */
