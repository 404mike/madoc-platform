create or replace function addCanvasesToManifest(
    manifest_id int,
    canvas_ids int[],
    site_context text
) returns boolean as
$$
declare
    canvas_ids_json json;
    canvas_id       int;
    derivative_id   int;
begin
    canvas_ids_json = to_json(canvas_ids);

    for key in 0..(array_length(canvas_ids, 1) - 1)
        loop
            canvas_id = canvas_ids_json -> key;
            insert into iiif_resource_items (item_id, resource_id, item_index)
            select canvas_id   as item_id,
                   manifest_id as resource_id,
                   key         as item_index
            on conflict (resource_id, item_id) do update set item_index = key;
        end loop;

    if site_context is not null then
        -- We need the derived manifest id.
        select id
        from iiif_derivative
        where resource_id = manifest_id
          and context <@ site_context::ltree
        into derivative_id;

        for key in 0..(array_length(canvas_ids, 1) - 1)
            loop
                canvas_id = canvas_ids_json -> key;

                update iiif_derivative
                set context        = array [(site_context || '.manifest_' || derivative_id)::ltree]::ltree[],
                    resource_index = key
                where type = 'canvas'
                  and resource_id = canvas_id
                  and context <@ site_context::ltree;
                if not found then
                    perform deriveresource(canvas_id, site_context || '.manifest_' || derivative_id);
                end if;
            end loop;
    end if;

    return true;
end;
$$ language plpgsql;

create or replace function addManifestsToCollection(
    collection_id int,
    manifest_ids int[],
    site_context text
) returns boolean as
$$
declare
    manifest_ids_json json;
    manifest_id       int;
    derivative_id     int;
begin
    manifest_ids_json = to_json(manifest_ids);

    for key in 0..(array_length(manifest_ids, 1) - 1)
        loop
            manifest_id = manifest_ids_json -> key;
            insert into iiif_resource_items (item_id, resource_id, item_index)
            select manifest_id   as item_id,
                   collection_id as resource_id,
                   key           as item_index
            on conflict (resource_id, item_id) do update set item_index = key;
        end loop;
    return true;
end;
$$ language plpgsql;

create or replace function create_resource(
    resourceType text,
    inputSource text,
    siteId int,
    metadata json
)
    returns int as
$id$
declare
    canonical_resource_id  int;
    derivative_resource_id int;
begin
    -- Insert into resource, ignore conflict.
    insert into iiif_resource (type, source)
    values (resourceType, inputSource)
    on conflict do nothing;

    select id from iiif_resource ir where ir.type = resourceType and ir.source = inputSource into canonical_resource_id;

    if metadata is not null then
        perform add_metadata(metadata, canonical_resource_id, null);
    end if;

    if siteId is not null then
        insert into iiif_derivative (type, resource_id, context)
        values (resourceType, canonical_resource_id, ('site_' || siteId::text)::ltree)
        on conflict do nothing;

        if metadata is not null then
            select id
            from iiif_derivative ifd
            where ifd.type = resourceType
              and ifd.resource_id = canonical_resource_id
              and context = array [('site_' || siteId::text)::ltree]::ltree[]
            into derivative_resource_id;
            perform add_metadata(metadata, canonical_resource_id, derivative_resource_id);
        end if;
    end if;

    return canonical_resource_id;
end;
$id$ language plpgsql;

create or replace function add_item_context(
    site_id int,
    target_type text,
    target_id int,
    item_ids int[]
) returns boolean as
$$
declare
    descendant          record;
    existing_contexts   ltree[];
    context_to_add      ltree;
    existing_context    ltree;
    target_item_context text;
    new_target_contexts ltree[];
    item                record;
    ctx_query           lquery;
    desc_context        ltree;
    desc_context_to_add ltree[];
    item_urn            text;
begin

    target_item_context = target_type || '_' || target_id;
    raise notice 'New context being added using input: %', target_item_context;

    -- Default context that will always be applied.
    new_target_contexts = (ARRAY [
        ('site_' || site_id || '.' || target_type || '_' || target_id)::lquery
        ])::lquery[];

    raise notice 'Setting default context to add to resources: %', new_target_contexts;

    -- Example, adding canvas to a manifest that's already in a collection (1, 'manifest_1', [2]);
    -- Collection: site_1
    -- Manifest: site_1.collection_1
    -- Existing canvas (1): site_1.collection_1.manifest_1
    -- New canvas (2) before: site_1
    -- New canvas (2) after: site_1.manifest_1, site_1.collection_1.manifest_1 <-- this is what we need to figure out.

    -- Example: You are joining a canvas to a manifest, this is fetching the manifest and grabbing all of the
    --          contexts under the manifest. The manifest may be inside one or more collections.
    for existing_contexts in select context from iiif_derivative where id = target_id and type = target_type
        loop
            raise notice 'Found existing context %', existing_contexts;
            -- Continuing with the manifest example, if we come across a manifest within a collection it will look
            -- something like: { site_1, site_1.collection_1, site_1.collection_2 }
            foreach existing_context in array existing_contexts
                loop
                -- When adding a collection to a manifest, this may look like:
                --   { site_1, site_1.collection_1 } ~ '*.collection_1' = true
                --   { site_1 } ~ '*.collection_1'                      = true
                --
                -- In this case, the manifest is already part of the collection, so we skip it. Canvas example:
                --   { site_1.collection_1.manifest_1 } ~ '*.manifest_1' = true
                --   { site_1.collection_1 } ~ '*.manifest_1'            = false
                --
                -- It's always looking at the last node.
                    if (existing_context ~ ('*.' || target_item_context)::lquery) = false then
                        -- When we find a context like `site_1` that is not already added we create a new
                        -- context for the resource. When adding a manifest to a collection:
                        --  site_1.collection_1
                        -- When adding a canvas to a manifest:
                        --   site_1.manifest_1
                        -- When adding a canvas to a manifest that is inside of a collection:
                        --   site_1.collection_1.manifest_1
                        context_to_add = (existing_context::text || '.' || target_item_context::text)::ltree;

                        -- Now, if the manifest is already in site_1.collection_1 and we are adding a manifest to a collection
                        -- then we want to skip over that particular element (it's already in our search array for the next step).
                        if (context_to_add = ANY (new_target_contexts)) = false then
                            raise notice 'context_to_query % -> %', existing_context::text, existing_context::text || '.' || target_item_context::text;
                            -- We add this new context to the `new_target_contexts` which is used below to find sub-resources.
                            new_target_contexts = array_append(new_target_contexts,
                                                               (existing_context::text || '.' || target_item_context::text)::ltree);
                        else
                            raise notice 'skipping %', context_to_add;
                        end if;
                    else
                        raise notice 'Ignore context % ->', existing_context::text;
                    end if;
                end loop;
        end loop;

    raise notice 'Adding contexts to target % to items %', new_target_contexts, item_ids;

    -- We update our items that we want to link to the target with the newly constructed contexts.
    -- The merge_ltree_array will merge overlapping paths, examples:
    --
    --   merge_ltree_array([a], [a])        = [a]         | simple de-duplication
    --   merge_ltree_array([a], [a.b])      = [a.b]       | removing redundant entries
    --   merge_ltree_array([a.c], [a.b])    = [a.b, a.c]  | keeping entries that share nodes
    --   merge_ltree_array([a.b.c], [a.b])  = [a.b.c]     | ignoring the input if its already covered
    update iiif_derivative
    set context = merge_ltree_array(context, new_target_contexts)
    where id = ANY (item_ids);

    -- At this point we have something like this:
    --   List of manifest with context `site_1.collection_1`  | adding Manifest to collection
    --   Canvas with context `site_1.manifest_1`              | adding Canvas to Manifest
    --   Canvas with context `site_1.collection_1.manifest_1` | adding Canvas to Manifest inside collection
    --
    -- It is completely possible though that the contexts we've just updated have resources _under_ them
    -- like in the case of adding a manifest to a collection. This step will pick up the canvases that are
    -- under that manifest, and any resources that are potentially deeper.
    --
    -- It works by re-fetching the items and doing a query that looks roughly like this for finding canvases:
    --   select * from iiif_derivative where context ~ 'site_1.*.manifest_1'
    --
    -- This will return all of the canvases for that resource under the specified site.
    -- We then splice in a new context for each of those canvases. It transforms the following examples:
    --
    --      site_1.manifest_1      -> site_1.collection_1.manifest_1
    --
    -- but leaves the following intact:
    --
    --   site_1.manifest_2               | wrong manifest
    --   site_1.collection_2.manifest_2  | wrong manifest and collection
    --   site_1.collection_1.manifest_1  | already linked
    --
    -- There is likely a MUCH better way to do this. Inserting and updating these are painful, but the
    -- querying of these are easy.
    for item in select id, type, context from iiif_derivative where id = ANY (item_ids)
        loop
            raise notice 'Fetched resource item with ID: %', item.id;
            -- This is the urn of the current item.
            --   manifest_1  |  adding manifests to a collection, the `item` is a manifest
            --   canvas_1    |  adding canvases to a manifest, the `item` is a canvas
            --
            item_urn = item.type || '_' || item.id;

            -- This is the query we want to make against the database to find all items UNDER the items we've
            -- just updated the context for.
            --
            --   site_1.*.manifest_1  | adding manifests to a collection
            --   site_1.*.canvas_1    | adding canvases to a manifest, unlikely to find anything yet.
            --
            ctx_query = 'site_' || site_id || '.*.' || item_urn;

            raise notice 'Query to find items under the item: %', ctx_query;
            raise notice ' -> item urn: %', item_urn;
            raise notice ' -> item context: %', item.context;

            -- Here we perform the search to find the resources under the item we just updated.
            for descendant in select id, type, context from iiif_derivative where context ~ ctx_query
                loop
                    raise notice '-> Found descendant: %', descendant.id;

                    -- We may need to add multiple contexts to these resources. We want to find any references to
                    -- the manifest (in when these descendants are canvases) and append the new collection.
                    -- so wherever we see `manifest_1` we want to change it to `collection_1.manifest_1`
                    desc_context_to_add = (ARRAY [])::ltree[];

                    -- We loop through all of the contexts on the canvas (most likely atm.)
                    foreach desc_context in array descendant.context
                        loop
                        -- When we made our initial search using `ctx_query` we searched across
                        -- all of the contexts that the canvas may have. It could be in a different
                        -- manifest. We want to re-check the context matches.
                            if desc_context ~ ctx_query and
                                -- We also want to avoid adding a strangely nested context.
                                -- In a case where we already have added a manifest to a collection – we are updating
                                -- the canvases here - we might see a context like this:
                                --
                                --   site_1.collection_2.manifest_1 | not our target collection_1
                                --
                                -- Since it matches our query, without this check it would add:
                                --
                                --   site_1.collection_2.collection_1.manifest_1
                                --
                                -- Instead of skipping over this. Collections within collections are not supported
                                -- at the moment due to this quirk.
                               (desc_context ~ ('*.' || target_type || '_*.*')::lquery) = false then
                                -- Great, at this point we have something we can work with. 99% of the time it will
                                -- look like:
                                --   site_1.manifest_1
                                raise notice '-> Appending new context to: %', desc_context;

                                -- We need to take `site_1.manifest_1` and make `site_1.collection_1.manifest_1`
                                -- to keep the item in sync with the changes we just made.
                                -- this is roughly an insert before function. It finds the index of `manifest_1`
                                -- chops off everything before it (the first section
                                -- Slots in our new context (the target_item_context)
                                -- Adds the second half of the original
                                desc_context_to_add = array_append(desc_context_to_add, (
                                    -- before the target resource
                                                    subpath(desc_context, 0, index(desc_context, item_urn::ltree))::text
                                                    || '.'
                                                -- new context
                                                || target_item_context
                                            || '.'
                                        -- target resource + anything else.
                                        || subpath(desc_context, index(desc_context, item_urn::ltree))::text)::ltree
                                    );
                            end if;
                        end loop;

                    -- If we had contexts to update this is where we add them
                    if array_length(desc_context_to_add, 1) > 0 then
                        raise notice 'Adding subpaths % to %', desc_context_to_add, descendant.id;

                        -- It's possible we could have done this as one large update on all of the items
                        -- but this is intended to be slow and steady for correctness.
                        update iiif_derivative
                        set context = merge_ltree_array(context, desc_context_to_add)
                        where id = descendant.id;

                    end if;
                end loop;
        end loop;
    return true;
end
$$ language plpgsql;

rollback;
begin;
select *
from create_collection('{
  "label": {
    "en": [
      "My collection"
    ]
  }
}', 1, null);

select *
from iiif_resource
where type = 'collection';
select *
from iiif_derivative
where type = 'collection';


select *
from create_manifest('{
  "@context": "http://iiif.io/api/presentation/3/context.json",
  "id": "https://example.org/iiif/book1/manifest",
  "type": "Manifest",
  "label": {
    "en": [
      "Book 1"
    ]
  },
  "metadata": [
    {
      "label": {
        "en": [
          "Author"
        ]
      },
      "value": {
        "none": [
          "Anne Author"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Published"
        ]
      },
      "value": {
        "en": [
          "Paris, circa 1400"
        ],
        "fr": [
          "Paris, environ 1400"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Notes"
        ]
      },
      "value": {
        "en": [
          "Text of note 1",
          "Text of note 2"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Source"
        ]
      },
      "value": {
        "none": [
          "<span>From: <a href=\"https://example.org/db/1.html\">Some Collection</a></span>"
        ]
      }
    }
  ],
  "summary": {
    "en": [
      "Book 1, written by Anne Author, published in Paris around 1400."
    ]
  },
  "thumbnail": [
    {
      "id": "https://example.org/iiif/book1/page1/full/80,100/0/default.jpg",
      "type": "Image",
      "format": "image/jpeg",
      "service": [
        {
          "id": "https://example.org/iiif/book1/page1",
          "type": "ImageService3",
          "profile": "level1"
        }
      ]
    }
  ],
  "viewingDirection": "right-to-left",
  "behavior": [
    "paged"
  ],
  "navDate": "1856-01-01T00:00:00Z",
  "rights": "https://creativecommons.org/licenses/by/4.0/",
  "requiredStatement": {
    "label": {
      "en": [
        "Attribution"
      ]
    },
    "value": {
      "en": [
        "Provided by Example Organization"
      ]
    }
  },
  "provider": [
    {
      "id": "https://example.org/about",
      "type": "Agent",
      "label": {
        "en": [
          "Example Organization"
        ]
      },
      "homepage": [
        {
          "id": "https://example.org/",
          "type": "Text",
          "label": {
            "en": [
              "Example Organization Homepage"
            ]
          },
          "format": "text/html"
        }
      ],
      "logo": [
        {
          "id": "https://example.org/service/inst1/full/max/0/default.png",
          "type": "Image",
          "format": "image/png",
          "service": [
            {
              "id": "https://example.org/service/inst1",
              "type": "ImageService3",
              "profile": "level2"
            }
          ]
        }
      ],
      "seeAlso": [
        {
          "id": "https://data.example.org/about/us.jsonld",
          "type": "Dataset",
          "format": "application/ld+json",
          "profile": "https://schema.org/"
        }
      ]
    }
  ],
  "homepage": [
    {
      "id": "https://example.org/info/book1/",
      "type": "Text",
      "label": {
        "en": [
          "Home page for Book 1"
        ]
      },
      "format": "text/html"
    }
  ],
  "service": [
    {
      "id": "https://example.org/service/example",
      "type": "ExampleExtensionService",
      "profile": "https://example.org/docs/example-service.html"
    }
  ],
  "seeAlso": [
    {
      "id": "https://example.org/library/catalog/book1.xml",
      "type": "Dataset",
      "format": "text/xml",
      "profile": "https://example.org/profiles/bibliographic"
    }
  ],
  "rendering": [
    {
      "id": "https://example.org/iiif/book1.pdf",
      "type": "Text",
      "label": {
        "en": [
          "Download as PDF"
        ]
      },
      "format": "application/pdf"
    }
  ],
  "partOf": [
    {
      "id": "https://example.org/collections/books/",
      "type": "Collection"
    }
  ],
  "start": {
    "id": "https://example.org/iiif/book1/canvas/p2",
    "type": "Canvas"
  },
  "items": [
    {
      "id": "https://example.org/iiif/book1/canvas/p1",
      "type": "Canvas",
      "label": {
        "none": [
          "p. 1"
        ]
      }
    }
  ],
  "structures": [
    {
      "id": "https://example.org/iiif/book1/range/top",
      "type": "Range"
    }
  ],
  "annotations": [
    {
      "id": "https://example.org/iiif/book1/annotations/p1",
      "type": "AnnotationPage",
      "items": [
      ]
    }
  ]
}', null, 1, null);

select *
from iiif_resource
where type = 'manifest';

select *
from iiif_derivative
where type = 'manifest';

select *
from create_canvas('{
  "id": "https://example.org/canvas/new-1.json",
  "duration": 12.4,
  "label": {
    "en": [
      "Page 1"
    ]
  },
  "metadata": [
    {
      "label": {
        "en": [
          "Author"
        ]
      },
      "value": {
        "none": [
          "Anne Author"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Published"
        ]
      },
      "value": {
        "en": [
          "Paris, circa 1400"
        ],
        "fr": [
          "Paris, environ 1400"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Notes"
        ]
      },
      "value": {
        "en": [
          "Text of note 1",
          "Text of note 2"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Source"
        ]
      },
      "value": {
        "none": [
          "<span>From: <a href=\"https://example.org/db/1.html\">Some Collection</a></span>"
        ]
      }
    }
  ],
  "summary": {
    "en": [
      "Book 1, written by Anne Author, published in Paris around 1400."
    ]
  }
}', null, null, 1, null);
select *
from create_canvas('{
  "id": "https://example.org/canvas/new-2.json",
  "duration": 12.4,
  "label": {
    "en": [
      "Page 1"
    ]
  },
  "metadata": [
    {
      "label": {
        "en": [
          "Author"
        ]
      },
      "value": {
        "none": [
          "Anne Author"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Published"
        ]
      },
      "value": {
        "en": [
          "Paris, circa 1400"
        ],
        "fr": [
          "Paris, environ 1400"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Notes"
        ]
      },
      "value": {
        "en": [
          "Text of note 1",
          "Text of note 2"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Source"
        ]
      },
      "value": {
        "none": [
          "<span>From: <a href=\"https://example.org/db/1.html\">Some Collection</a></span>"
        ]
      }
    }
  ],
  "summary": {
    "en": [
      "Book 1, written by Anne Author, published in Paris around 1400."
    ]
  }
}', null, null, 1, null);
select *
from create_canvas('{
  "id": "https://example.org/canvas/new-3.json",
  "duration": 12.4,
  "label": {
    "en": [
      "Page 1"
    ]
  },
  "metadata": [
    {
      "label": {
        "en": [
          "Author"
        ]
      },
      "value": {
        "none": [
          "Anne Author"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Published"
        ]
      },
      "value": {
        "en": [
          "Paris, circa 1400"
        ],
        "fr": [
          "Paris, environ 1400"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Notes"
        ]
      },
      "value": {
        "en": [
          "Text of note 1",
          "Text of note 2"
        ]
      }
    },
    {
      "label": {
        "en": [
          "Source"
        ]
      },
      "value": {
        "none": [
          "<span>From: <a href=\"https://example.org/db/1.html\">Some Collection</a></span>"
        ]
      }
    }
  ],
  "summary": {
    "en": [
      "Book 1, written by Anne Author, published in Paris around 1400."
    ]
  }
}', null, null, 1, null);

select *
from iiif_resource;

select *
from iiif_derivative
where type = 'canvas'
  and context ~ 'site_1.*'::lquery;

commit;


begin;

select *
from iiif_derivative;
select *
from iiif_resource;
select *
from iiif_resource_items;

select *
from add_canvases_to_manifest(1, 2, ARRAY [3, 4]);

select *
from add_manifests_to_collection(1, 1, ARRAY [2]);

select *
from add_canvases_to_manifest(1, 2, ARRAY [5]);

select *
from add_manifests_to_collection(1, 6, ARRAY [2]);










select *
from iiif_derivative;
rollback;
commit;


-- New
begin;
select add_item_context_2(1, 'manifest', 2, 'canvas', ARRAY [3, 4]);
select add_item_context_2(1, 'collection', 1, 'manifest', ARRAY [2]);
commit;
select add_item_context_2(1, 'manifest', 2, 'canvas', ARRAY [5]);



select array['site_1.manifest_1', 'site_1.manifest_2']::ltree[] ?<@ 'site_1.manifest_1'::ltree as t;

select ifd.context, ir.type, ir.id,


       (
           -- before the target resource
                           subpath(ifd.context, 0, index(ifd.context, 'manifest_2'))::text
                           || '.'
                       -- new context
                       || 'collection_1'
                   || '.'
               -- target resource + anything else.
               || subpath(ifd.context,
                          index(ifd.context, 'manifest_2'))::text)::ltree as nextContext


from iiif_derivative ifd
         left join iiif_resource ir on ifd.resource_id = ir.id
where context <@ array ['site_1.manifest_1', 'site_1.manifest_2']::ltree[];

select *
from iiif_derivative;
rollback;

begin;
select * from iiif_metadata where resource_id = 1;
select update_metadata_field(1, 'label', 'en', 'iiif', 'CHANGED COLLECTION', null);
select update_metadata_field(1, 'label', 'en', 'iiif', 'CHANGED SITE 1 COLLECTION', 1);
select update_metadata_field(1, 'label', 'en', 'iiif', 'CHANGED AGAIN COLLECTION', null);
rollback;

select * from iiif_derivative where context ~ 'site_1.*.manifest_2';

begin;
select * from iiif_derivative where context ~ 'site_1.*.manifest_2';

select reorder_context(1, 'manifest', 2, array[4, 5]); -- 4 = 1, 5 = 2
select reorder_context(1, 'manifest', 2, array[5, 4]); -- 4 = 2, 5 = 1


-- reorder_context(site, type, id, [ids])
-- reorder collection
-- Trigger on update metadata
-- Function/Query for missing metadata on site



-- Add canvases to manifest_1
--    manifest ctx   = site_1.collection_1
--    manifest ctx   = site_1.collection_2
-- Target canvas ctx:
--    site_1.collection_1.manifest_1
--    site_1.collection_2.manifest_1
--
-- So it's always just using the manifest, until it's not.
--   Add manifest to collection needs to add new entry for canvases.


select context
from iiif_derivative
where resource_id = 2
  and context <@ 'site_1';



-- We need a function that can:
-- add_contexts_to_resource(site_id, resource_id, contexts[])
--  -> de-duplicate contexts
--  -> For each context
--    -> Delete any context that is superceded by the ones we want to add
--    -> insert new ones
--
-- New function
-- remove_context_from_resource(site_id, resource_id, context);
--   -> Find all items with context under site and resource_id
--   -> Update each to remove
--   -> remove duplicates – although this won't affect the app.
--
--
-- --> New feature, any insert into derived will insert an index based on count of other items in context.
-- Contexts we can update with our new one, since it matches.
select *
from iiif_derivative
where 'site_1.manifest_1'::ltree <@ context;
-- Otherwise, insert new.

select t as test, t + 1 as test1
from unnest(array [1, 2, 3]) t;

rollback;
begin;

select add_item_context(1, 'manifest', 4, array [5, 6, 7]);
select *
from iiif_derivative;
rollback;

commit;

begin;

select * from iiif_derivative;

select remove_item_context(1, 'manifest', 2, 'canvas', 3);

-- | Remaining functions
-- remove canvas from manifest
--   -> query to find items.
--  Test: remove canvas:4 from manifest:2
select *
from iiif_derivative
where (context ~ 'site_1.*.manifest_2' and resource_id = 4)
   or context ~ 'site_1.*.manifest_2.canvas_4';
--   -> For each of the items, for each of their contexts.
--   -> New function to un-splice manifest and push onto array
--   -> Set context to this array, running through de-duplication


-- remove manifest from collection
-- -> query to find items.
-- Test: remove manifest:14 from collection:13
select context, (remove_from_subpath(context, 'collection_13'::ltree)) as context_new
from iiif_derivative
where (context ~ 'site_1.*.collection_13' and resource_id = 14)
   or context ~ 'site_1.*.collection_13.*.manifest_14';

begin;

select remove_from_context(1, 'manifest', 14, 'collection', 13);

select remove_from_context(1, 'canvas', 16, 'manifest', 14);

update iiif_derivative
set context = remove_from_subpath(context, 'collection_13'::ltree)
where (context ~ 'site_1.*.collection_13' and resource_id = 14)
   or context ~ 'site_1.*.collection_13.*.manifest_14';

select *
from add_manifests_to_collection(1, 13, ARRAY [14]);

select *
from iiif_derivative;

rollback;



-- Next.
-- reorder manifest

select *
from iiif_derivative;

-- reorder_context(site, type, id, [ids])
-- reorder collection
-- Trigger on update metadata
-- Function/Query for missing metadata on site


select remove_from_subpath(
               array ['a.b.NEW'::ltree, 'NEW.a.b'::ltree, 'nope.dont'::ltree, 'a.b.c.NEW.d.e'::ltree, 'a.b.NEW.c.d.e'::ltree]::ltree[],
               'NEW');

-- -> 'a.b.c.NEW.d.e', 'NEW'
select subpath('a.b.c.NEW.d.e', 0, index('a.b.c.NEW.d.e', 'NEW')) ||
       subpath('a.b.c.NEW.d.e', 1 + index('a.b.c.NEW.d.e', 'NEW'));

select (subpath('a.b.c.d.e', 0, index('a.b.c.d.e', 'c'))::text || '.NEW.' ||
        subpath('a.b.c.d.e', index('a.b.c.d.e', 'c'))::text);
-- insert_before('site_1.manifest_4', 'manifest_4', 'collection_1')
select (subpath('site_1.manifest_4', 0, index('site_1.manifest_4', 'manifest_4'))::text || '.collection_1.' ||
        subpath('site_1.manifest_4', index('site_1.manifest_4', 'manifest_4'))::text);
select (subpath('site_1.manifest_4', 0, index('site_1.manifest_4', 'manifest_4'))::text || '.collection_1.' ||
        subpath('site_1.manifest_4', index('site_1.manifest_4', 'manifest_4'))::text);


create or replace function remove_from_context(
    site_id int,
    remove_type text,
    remove_id int,
    remove_from_type text,
    remove_from_id int
) returns boolean as
$$
declare
    site_urn        text;
    remove_urn      text;
    remove_from_urn text;
begin
    site_urn = ('site_' || site_id::text)::text;
    remove_urn = (remove_type || '_' || remove_id::text)::text;
    remove_from_urn = (remove_from_type || '_' || remove_from_id::text)::text;

    update iiif_derivative
    set context = remove_from_subpath(context, remove_from_urn::ltree)
    where (context ~ (site_urn || '.*.' || remove_from_urn)::lquery and resource_id = remove_id)
       or context ~ (site_urn || '.*.' || remove_from_urn || '.*.' || remove_urn)::lquery;

    return true;
end;


$$ language plpgsql;

create or replace function add_item_context(
    sid int,
    target_type text,
    target_id int,
    item_ids int[]
) returns boolean as
$$
declare
    descendant          record;
    context_to_add      ltree;
    existing_context    ltree;
    target_item_context text;
    new_target_context  ltree;
    new_target_contexts ltree[];
    item                record;
    ctx_query           lquery;
    desc_context        ltree;
    desc_context_to_add ltree;
    item_urn            text;
begin

    target_item_context = target_type || '_' || target_id;
    raise notice 'New context being added using input: %', target_item_context;

    -- Default context that will always be applied.
    new_target_contexts = (ARRAY [])::lquery[];

    raise notice 'Setting default context to add to resources: %', new_target_contexts;

    -- Example, adding canvas to a manifest that's already in a collection (1, 'manifest_1', [2]);
    -- Collection: site_1
    -- Manifest: site_1.collection_1
    -- Existing canvas (1): site_1.collection_1.manifest_1
    -- New canvas (2) before: site_1
    -- New canvas (2) after: site_1.manifest_1, site_1.collection_1.manifest_1 <-- this is what we need to figure out.

    -- Example: You are joining a canvas to a manifest, this is fetching the manifest and grabbing all of the
    --          contexts under the manifest. The manifest may be inside one or more collections.
    for existing_context in select context
                            from iiif_derivative
                            where resource_id = target_id
                              and type = target_type
        loop
            raise notice 'Found existing context %', existing_context;
            -- Continuing with the manifest example, if we come across a manifest within a collection it will look
            -- something like: { site_1, site_1.collection_1, site_1.collection_2 }

            -- When adding a collection to a manifest, this may look like:
            --   { site_1, site_1.collection_1 } ~ '*.collection_1' = true
            --   { site_1 } ~ '*.collection_1'                      = true
            --
            -- In this case, the manifest is already part of the collection, so we skip it. Canvas example:
            --   { site_1.collection_1.manifest_1 } ~ '*.manifest_1' = true
            --   { site_1.collection_1 } ~ '*.manifest_1'            = false
            --
            -- It's always looking at the last node.
            if (existing_context ~ ('*.' || target_item_context)::lquery) = false then
                -- When we find a context like `site_1` that is not already added we create a new
                -- context for the resource. When adding a manifest to a collection:
                --  site_1.collection_1
                -- When adding a canvas to a manifest:
                --   site_1.manifest_1
                -- When adding a canvas to a manifest that is inside of a collection:
                --   site_1.collection_1.manifest_1
                context_to_add = (existing_context::text || '.' || target_item_context::text)::ltree;

                -- Now, if the manifest is already in site_1.collection_1 and we are adding a manifest to a collection
                -- then we want to skip over that particular element (it's already in our search array for the next step).
                if (context_to_add = ANY (new_target_contexts)) = false then
                    raise notice 'context_to_query % -> %', existing_context::text, existing_context::text || '.' || target_item_context::text;
                    -- We add this new context to the `new_target_contexts` which is used below to find sub-resources.
                    new_target_contexts = merge_ltree_array(new_target_contexts,
                                                            array [(existing_context::text || '.' || target_item_context::text)::ltree]::ltree[]);
                else
                    raise notice 'skipping %', context_to_add;
                end if;
            else
                raise notice 'Ignore context % ->', existing_context::text;
            end if;
        end loop;

    if array_length(new_target_contexts, 1) = 0 then
        new_target_contexts = new_target_contexts = (ARRAY [
            ('site_' || sid || '.' || target_type || '_' || target_id)::lquery
            ])::lquery[];
    end if;

    raise notice 'Adding contexts to target % to items %', new_target_contexts, item_ids;

    -- We update our items that we want to link to the target with the newly constructed contexts.
    -- The merge_ltree_array will merge overlapping paths, examples:
    --
    --   merge_ltree_array([a], [a])        = [a]         | simple de-duplication
    --   merge_ltree_array([a], [a.b])      = [a.b]       | removing redundant entries
    --   merge_ltree_array([a.c], [a.b])    = [a.b, a.c]  | keeping entries that share nodes
    --   merge_ltree_array([a.b.c], [a.b])  = [a.b.c]     | ignoring the input if its already covered

--     update iiif_derivative
--     set context = merge_ltree_array(context, new_target_contexts)
--     where id = ANY (item_ids);

    -- At this point we have something like this:
    --   List of manifest with context `site_1.collection_1`  | adding Manifest to collection
    --   Canvas with context `site_1.manifest_1`              | adding Canvas to Manifest
    --   Canvas with context `site_1.collection_1.manifest_1` | adding Canvas to Manifest inside collection
    --
    -- It is completely possible though that the contexts we've just updated have resources _under_ them
    -- like in the case of adding a manifest to a collection. This step will pick up the canvases that are
    -- under that manifest, and any resources that are potentially deeper.
    --
    -- It works by re-fetching the items and doing a query that looks roughly like this for finding canvases:
    --   select * from iiif_derivative where context ~ 'site_1.*.manifest_1'
    --
    -- This will return all of the canvases for that resource under the specified site.
    -- We then splice in a new context for each of those canvases. It transforms the following examples:
    --
    --      site_1.manifest_1      -> site_1.collection_1.manifest_1
    --
    -- but leaves the following intact:
    --
    --   site_1.manifest_2               | wrong manifest
    --   site_1.collection_2.manifest_2  | wrong manifest and collection
    --   site_1.collection_1.manifest_1  | already linked
    --
    -- There is likely a MUCH better way to do this. Inserting and updating these are painful, but the
    -- querying of these are easy.
    for item in select id, type from iiif_resource where id = ANY (item_ids)
        loop
            raise notice 'Fetched resource item with ID: %', item.id;

            foreach new_target_context in array new_target_contexts
                loop
                    update iiif_derivative idr
                    set context = new_target_context
                    where idr.type = item.type
                      and idr.resource_id = item.id
                      and context @> new_target_context;
                end loop;


            insert into iiif_derivative (type, resource_id, context)
            select item.type as type,
                   item.id   as resource_id,
                   c         as context
            from unnest(new_target_contexts) c
            on conflict do nothing;

            -- This is the urn of the current item.
            --   manifest_1  |  adding manifests to a collection, the `item` is a manifest
            --   canvas_1    |  adding canvases to a manifest, the `item` is a canvas
            --
            item_urn = item.type || '_' || item.id;

            -- This is the query we want to make against the database to find all items UNDER the items we've
            -- just updated the context for.
            --
            --   site_1.*.manifest_1  | adding manifests to a collection
            --   site_1.*.canvas_1    | adding canvases to a manifest, unlikely to find anything yet.
            --
            ctx_query = 'site_' || sid || '.*.' || item_urn;

            raise notice 'Query to find items under the item: %', ctx_query;
            raise notice ' -> item urn: %', item_urn;
            -- raise notice ' -> item context: %', item.context;

            -- Here we perform the search to find the resources under the item we just updated.
            for descendant in select id, type, context from iiif_derivative where context ~ ctx_query
                loop
                    raise notice '-> Found descendant: %', descendant.id;

                    -- We may need to add multiple contexts to these resources. We want to find any references to
                    -- the manifest (in when these descendants are canvases) and append the new collection.
                    -- so wherever we see `manifest_1` we want to change it to `collection_1.manifest_1`

                    -- When we made our initial search using `ctx_query` we searched across
                    -- all of the contexts that the canvas may have. It could be in a different
                    -- manifest. We want to re-check the context matches.
                    if descendant.context ~ ctx_query and
                        -- We also want to avoid adding a strangely nested context.
                        -- In a case where we already have added a manifest to a collection – we are updating
                        -- the canvases here - we might see a context like this:
                        --
                        --   site_1.collection_2.manifest_1 | not our target collection_1
                        --
                        -- Since it matches our query, without this check it would add:
                        --
                        --   site_1.collection_2.collection_1.manifest_1
                        --
                        -- Instead of skipping over this. Collections within collections are not supported
                        -- at the moment due to this quirk.
                       (descendant.context ~ ('*.' || target_type || '_*.*')::lquery) = false then
                        -- Great, at this point we have something we can work with. 99% of the time it will
                        -- look like:
                        --   site_1.manifest_1
                        raise notice '-> Appending new context to: %', descendant.context;

                        -- We need to take `site_1.manifest_1` and make `site_1.collection_1.manifest_1`
                        -- to keep the item in sync with the changes we just made.
                        -- this is roughly an insert before function. It finds the index of `manifest_1`
                        -- chops off everything before it (the first section
                        -- Slots in our new context (the target_item_context)
                        -- Adds the second half of the original
                        desc_context_to_add = (
                            -- before the target resource
                                            subpath(descendant.context, 0, index(descendant.context, item_urn::ltree))::text
                                            || '.'
                                        -- new context
                                        || target_item_context
                                    || '.'
                                -- target resource + anything else.
                                || subpath(descendant.context,
                                           index(descendant.context, item_urn::ltree))::text)::ltree;

                    end if;


                    -- If we had contexts to update this is where we add them
                    if desc_context_to_add is not null then
                        raise notice 'Adding subpaths % to % (%)', desc_context_to_add, descendant.id, descendant.context;

                        -- It's possible we could have done this as one large update on all of the items
                        -- but this is intended to be slow and steady for correctness.
                        -- site_1
                        -- site_1.collection_1
                        if descendant.context <@ desc_context_to_add then
                            raise notice 'Updating existing context, % -> %', descendant.context, desc_context_to_add;
                            update iiif_derivative
                            set context = desc_context_to_add
                            where id = descendant.id;
                        else
                            raise notice 'Inserting new context: %', desc_context_to_add;
                            insert into iiif_derivative (type, resource_id, resource_index, context)
                            select ird.type,
                                   ird.resource_id,
                                   ird.resource_index,
                                   desc_context_to_add as context
                            from iiif_derivative ird
                            where id = descendant.id
                            on conflict do nothing;
                        end if;
                    end if;
                end loop;
        end loop;
    return true;
end
$$ language plpgsql;

-- OLD BELOW

-- Link manifest to collection
-- Trigger on update metadata
-- Function/Query for missing metadata on site

-- Changes to the queue
-- 1) Will not add to site until fully imported (yay?)
-- 2) Can be fully-repeated without issue hopefully
-- 3) The final step cannot be fully repeated, I don't think

-- LIMITATIONS
--  -> Collections structure is shared across sites
--  -> Collections can exist without a site
--  -> If you update a collection on site, it will be reflected globally
--  -> Excluding metadata.
--  -> It's not cheap to run searching within collections at the moment, we would need to shift to ltree[]


-- ltree[] - Fresh eyes required.
-- When adding canvases to a manifest, a new context would be created (site_1.manifest_1) on the canvas
-- When adding a manifest to a collection, a new context would be added to manifest: site_1.collection_1 and to all items
-- matching that manifest site_1.collection_1.manifest_1
-- Canvas over time:
-- [ 'site_1' ]
-- [ 'site_1.manifest_1' ] <-- added to manifest
-- [ 'site_1.manifest_1', 'site_1.manifest_2' ] <-- added to a second manifest
-- [ 'site_1.manifest_1', 'site_1.collection_1.manifest_2' ] <-- manifest added to collection (change from `site_1.manifest_2` -> `site_1.collection_1.manifest_2` where context is `site_1.manifest_2`)
-- [ 'site_1.manifest_1', 'site_1.collection_1.manifest_2', 'site_1.collection_2.manifest_2' ] <-- manifest added to another collection (add new)
--
-- Operations:
-- Add context a.b to manifest<c> (update ctx.manifest_c.* to be ctx.a.b.manifest_c.*)
-- Remove context a.b. from manifest<c> (update ctx.manifest_c)

-- Add op:
-- Add context a.b to item with context a
-- add a.b to item< c >
-- add where context <@ a add a.b.c
-- Remove op:
-- Remove context a.b from item with context a (c = a.b)
-- Remove context a.b.c -> each of these do the same thing.

-- We need two operations
-- addContext( ctx, item_ids[] );
-- removeContext( ctx, item_ids[] );
-- changeContext ( fromCtx, toCtx, item_ids[] );
--
-- They can be slow AF for now
-- Real-world operations
-- Add manifest to collection
-- Add canvas to manifest
-- Remove manifest from collection
-- Remove canvas from manifest


drop table test_context
create table test_context
(
    id      serial not null
        constraint test_context_pk
            primary key,
    type    text   not null,
    label   text   not null,
    context ltree[]
);

alter table test_context
    owner to madoc;

-- Add some test data.
truncate table test_context restart identity;
insert into test_context (type, label, context)
VALUES ('collection', 'Collection A', ARRAY ['site_1']::ltree[]),
       ('collection', 'Collection B', ARRAY ['site_1']::ltree[]),
       ('collection', 'Collection C', ARRAY ['site_1']::ltree[]),

       ('manifest', 'Manifest A', ARRAY ['site_1']::ltree[]),
       ('manifest', 'Manifest B', ARRAY ['site_1']::ltree[]),
       ('manifest', 'Manifest C', ARRAY ['site_1']::ltree[]),
       ('manifest', 'Manifest D', ARRAY ['site_1']::ltree[]),
       ('manifest', 'Manifest E', ARRAY ['site_1']::ltree[]),
       ('manifest', 'Manifest F', ARRAY ['site_1']::ltree[]),

       ('canvas', 'Canvas A-1', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas A-2', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas A-3', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas B-1', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas B-2', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas B-3', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas C-1', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas C-2', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas C-3', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas D-1', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas D-2', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas D-3', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas E-1', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas E-2', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas E-3', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas F-1', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas F-2', ARRAY ['site_1']::ltree[]),
       ('canvas', 'Canvas F-3', ARRAY ['site_1']::ltree[]);


-- Add context
create or replace function test_context_add(
    site_id int,
    target_type text,
    target_id int,
    item_ids int[]
) returns boolean as
$$
declare
    descendant          record;
    existing_contexts   ltree[];
    context_to_add      ltree;
    existing_context    ltree;
    target_item_context text;
    new_target_contexts ltree[];
    item                record;
    ctx_query           lquery;
    desc_context        ltree;
    desc_context_to_add ltree[];
    item_urn            text;
begin

    target_item_context = target_type || '_' || target_id;
    raise notice 'New context being added using input: %', target_item_context;

    -- Default context that will always be applied.
    new_target_contexts = (ARRAY [
        ('site_' || site_id || '.' || target_type || '_' || target_id)::lquery
        ])::lquery[];

    raise notice 'Setting default context to add to resources: %', new_target_contexts;

    -- Example, adding canvas to a manifest that's already in a collection (1, 'manifest_1', [2]);
    -- Collection: site_1
    -- Manifest: site_1.collection_1
    -- Existing canvas (1): site_1.collection_1.manifest_1
    -- New canvas (2) before: site_1
    -- New canvas (2) after: site_1.manifest_1, site_1.collection_1.manifest_1 <-- this is what we need to figure out.

    -- Example: You are joining a canvas to a manifest, this is fetching the manifest and grabbing all of the
    --          contexts under the manifest. The manifest may be inside one or more collections.
    for existing_contexts in select context from test_context where id = target_id and type = target_type
        loop
            raise notice 'Found existing context %', existing_contexts;
            -- Continuing with the manifest example, if we come across a manifest within a collection it will look
            -- something like: { site_1, site_1.collection_1, site_1.collection_2 }
            foreach existing_context in array existing_contexts
                loop
                -- When adding a collection to a manifest, this may look like:
                --   { site_1, site_1.collection_1 } ~ '*.collection_1' = true
                --   { site_1 } ~ '*.collection_1'                      = true
                --
                -- In this case, the manifest is already part of the collection, so we skip it. Canvas example:
                --   { site_1.collection_1.manifest_1 } ~ '*.manifest_1' = true
                --   { site_1.collection_1 } ~ '*.manifest_1'            = false
                --
                -- It's always looking at the last node.
                    if (existing_context ~ ('*.' || target_item_context)::lquery) = false then
                        -- When we find a context like `site_1` that is not already added we create a new
                        -- context for the resource. When adding a manifest to a collection:
                        --  site_1.collection_1
                        -- When adding a canvas to a manifest:
                        --   site_1.manifest_1
                        -- When adding a canvas to a manifest that is inside of a collection:
                        --   site_1.collection_1.manifest_1
                        context_to_add = (existing_context::text || '.' || target_item_context::text)::ltree;

                        -- Now, if the manifest is already in site_1.collection_1 and we are adding a manifest to a collection
                        -- then we want to skip over that particular element (it's already in our search array for the next step).
                        if (context_to_add = ANY (new_target_contexts)) = false then
                            raise notice 'context_to_query % -> %', existing_context::text, existing_context::text || '.' || target_item_context::text;
                            -- We add this new context to the `new_target_contexts` which is used below to find sub-resources.
                            new_target_contexts = array_append(new_target_contexts,
                                                               (existing_context::text || '.' || target_item_context::text)::ltree);
                        else
                            raise notice 'skipping %', context_to_add;
                        end if;
                    else
                        raise notice 'Ignore context % ->', existing_context::text;
                    end if;
                end loop;
        end loop;

    -- We update our items that we want to link to the target with the newly constructed contexts.
    -- The merge_ltree_array will merge overlapping paths, examples:
    --
    --   merge_ltree_array([a], [a])        = [a]         | simple de-duplication
    --   merge_ltree_array([a], [a.b])      = [a.b]       | removing redundant entries
    --   merge_ltree_array([a.c], [a.b])    = [a.b, a.c]  | keeping entries that share nodes
    --   merge_ltree_array([a.b.c], [a.b])  = [a.b.c]     | ignoring the input if its already covered
    update test_context
    set context = merge_ltree_array(context, new_target_contexts)
    where id = ANY (item_ids);

    -- At this point we have something like this:
    --   List of manifest with context `site_1.collection_1`  | adding Manifest to collection
    --   Canvas with context `site_1.manifest_1`              | adding Canvas to Manifest
    --   Canvas with context `site_1.collection_1.manifest_1` | adding Canvas to Manifest inside collection
    --
    -- It is completely possible though that the contexts we've just updated have resources _under_ them
    -- like in the case of adding a manifest to a collection. This step will pick up the canvases that are
    -- under that manifest, and any resources that are potentially deeper.
    --
    -- It works by re-fetching the items and doing a query that looks roughly like this for finding canvases:
    --   select * from test_context where context ~ 'site_1.*.manifest_1'
    --
    -- This will return all of the canvases for that resource under the specified site.
    -- We then splice in a new context for each of those canvases. It transforms the following examples:
    --
    --      site_1.manifest_1      -> site_1.collection_1.manifest_1
    --
    -- but leaves the following intact:
    --
    --   site_1.manifest_2               | wrong manifest
    --   site_1.collection_2.manifest_2  | wrong manifest and collection
    --   site_1.collection_1.manifest_1  | already linked
    --
    -- There is likely a MUCH better way to do this. Inserting and updating these are painful, but the
    -- querying of these are easy.
    for item in select id, type, context from test_context where id = ANY (item_ids)
        loop
            raise notice 'Fetched resource item with ID: %', item.id;
            -- This is the urn of the current item.
            --   manifest_1  |  adding manifests to a collection, the `item` is a manifest
            --   canvas_1    |  adding canvases to a manifest, the `item` is a canvas
            --
            item_urn = item.type || '_' || item.id;

            -- This is the query we want to make against the database to find all items UNDER the items we've
            -- just updated the context for.
            --
            --   site_1.*.manifest_1  | adding manifests to a collection
            --   site_1.*.canvas_1    | adding canvases to a manifest, unlikely to find anything yet.
            --
            ctx_query = 'site_' || site_id || '.*.' || item_urn;

            raise notice 'Query to find items under the item: %', ctx_query;
            raise notice ' -> item urn: %', item_urn;
            raise notice ' -> item context: %', item.context;

            -- Here we perform the search to find the resources under the item we just updated.
            for descendant in select id, type, context from test_context where context ~ ctx_query
                loop
                    raise notice '-> Found descendant: %', descendant.id;

                    -- We may need to add multiple contexts to these resources. We want to find any references to
                    -- the manifest (in when these descendants are canvases) and append the new collection.
                    -- so wherever we see `manifest_1` we want to change it to `collection_1.manifest_1`
                    desc_context_to_add = (ARRAY [])::ltree[];

                    -- We loop through all of the contexts on the canvas (most likely atm.)
                    foreach desc_context in array descendant.context
                        loop
                        -- When we made our initial search using `ctx_query` we searched across
                        -- all of the contexts that the canvas may have. It could be in a different
                        -- manifest. We want to re-check the context matches.
                            if desc_context ~ ctx_query and
                                -- We also want to avoid adding a strangely nested context.
                                -- In a case where we already have added a manifest to a collection – we are updating
                                -- the canvases here - we might see a context like this:
                                --
                                --   site_1.collection_2.manifest_1 | not our target collection_1
                                --
                                -- Since it matches our query, without this check it would add:
                                --
                                --   site_1.collection_2.collection_1.manifest_1
                                --
                                -- Instead of skipping over this. Collections within collections are not supported
                                -- at the moment due to this quirk.
                               (desc_context ~ ('*.' || target_type || '_*.*')::lquery) = false then
                                -- Great, at this point we have something we can work with. 99% of the time it will
                                -- look like:
                                --   site_1.manifest_1
                                raise notice '-> Appending new context to: %', desc_context;

                                -- We need to take `site_1.manifest_1` and make `site_1.collection_1.manifest_1`
                                -- to keep the item in sync with the changes we just made.
                                -- this is roughly an insert before function. It finds the index of `manifest_1`
                                -- chops off everything before it (the first section
                                -- Slots in our new context (the target_item_context)
                                -- Adds the second half of the original
                                desc_context_to_add = array_append(desc_context_to_add, (
                                    -- before the target resource
                                                    subpath(desc_context, 0, index(desc_context, item_urn::ltree))::text
                                                    || '.'
                                                -- new context
                                                || target_item_context
                                            || '.'
                                        -- target resource + anything else.
                                        || subpath(desc_context, index(desc_context, item_urn::ltree))::text)::ltree
                                    );
                            end if;
                        end loop;

                    -- If we had contexts to update this is where we add them
                    if array_length(desc_context_to_add, 1) > 0 then
                        raise notice 'Adding subpaths % to %', desc_context_to_add, descendant.id;

                        -- It's possible we could have done this as one large update on all of the items
                        -- but this is intended to be slow and steady for correctness.
                        update test_context
                        set context = merge_ltree_array(context, desc_context_to_add)
                        where id = descendant.id;

                    end if;
                end loop;
        end loop;
    return true;
end
$$ language plpgsql;

select *
from test_context;


begin;
select test_context_add(1, 'manifest', 4, ARRAY [10, 11]); -- working.
select test_context_add(1, 'manifest', 5, ARRAY [10, 11, 12]);
select test_context_add(1, 'collection', 2, ARRAY [4]);
select test_context_add(1, 'collection', 3, ARRAY [4]);
select *
from test_context;

select test_context_add(1, 'manifest', 4, ARRAY [12]);
select test_context_add(1, 'manifest', 4, ARRAY [18]);

select *
from test_context
where context <@ 'site_1'
  and type = 'manifest';

select test_context_add(2, 'manifest', 4, ARRAY [10, 11]);
-- working.

-- And then add a new canvas to manifest
-- how will this update the collection?
-- Since this is now in the collection
-- This will need to get all of the contexts of manifest_4
-- This level of function WILL NOT WORK.
rollback;

select ('site_1.collection_2.manifest_4'::ltree ~ '*.collection_*.*'::lquery);

select merge_ltree_array(ARRAY ['a', 'a.b.c', 'a.d']::ltree[], ARRAY ['a.b', 'a.b.c.d', 'd.e']::ltree[]);
-- ARRAY['a.b']

-- add_manifests_to_collection(sid, collection_id, manifest_ids);
--   -> Get all contexts on collection
--   -> Prepend collection_id
--   -> find all items within that manifest, add the same context (splicing) -- can this be recursive.

-- add_canvases_to_manifest(sid, manifest_id, canvas_ids); -- adding all contexts.
--   -> Get all contexts on manifest
--   -> Prepend manifest_id
--   -> Add those contexts to canvas

-- remove_manifest_from_collection(sid, collection_id, manifest_id);
-- Find all site_id.*.collection_id.manifest_id.* and remove those contexts from the list.

-- remove_canvas_from_manifest(sid, manifest_id, canvas_id);
-- Find all site_id.*.manifest_id.canvas_id.* and remove those contexts from the list.

select *
from test_context;

rollback;


-- Test: a.b.c.d.e -> a.b.NEW.c.d.e

-- site_1.manifest_4.* -> site_1.collection_1.manifest_4.*


-- insert_before('a.b.c.d.e', 'c', 'NEW') = a.b.NEW.c.d.e
select (subpath('a.b.c.d.e', 0, index('a.b.c.d.e', 'c'))::text || '.NEW.' ||
        subpath('a.b.c.d.e', index('a.b.c.d.e', 'c'))::text);
-- insert_before('site_1.manifest_4', 'manifest_4', 'collection_1')
select (subpath('site_1.manifest_4', 0, index('site_1.manifest_4', 'manifest_4'))::text || '.collection_1.' ||
        subpath('site_1.manifest_4', index('site_1.manifest_4', 'manifest_4'))::text);
select (subpath('site_1.manifest_4', 0, index('site_1.manifest_4', 'manifest_4'))::text || '.collection_1.' ||
        subpath('site_1.manifest_4', index('site_1.manifest_4', 'manifest_4'))::text);



























create table iiif_resource
(
    id serial not null
        constraint iiif_resource_pk
            primary key,
    type text not null,
    source text,
    localsource text,
    rights text,
    viewingdirection integer default 0,
    navdate timestamp,
    height integer,
    width integer,
    duration double precision,
    default_thumbnail text
);

alter table iiif_resource owner to madoc;

create unique index iiif_resource_source_uindex
    on iiif_resource (source);

create table iiif_derivative
(
    id serial not null
        constraint iiif_derivative_pk
            primary key,
    type text not null,
    resource_id integer not null
        constraint iiif_derivative_iiif_resource_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    resource_index integer default 0 not null,
    context ltree
);

alter table iiif_derivative owner to madoc;

create unique index iiif_derivative_resource_id_context_type_resource_index_uindex
    on iiif_derivative (resource_id, context, type, resource_index);

create table iiif_metadata
(
    id serial not null
        constraint iiif_metadata_pk
            unique,
    key text not null,
    value text,
    language text default '@none'::text not null,
    source text not null,
    resource_id integer not null
        constraint iiif_metadata_iiif_resource_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    site_id integer,
    readonly boolean default false,
    edited boolean default false,
    auto_update boolean default true,
    constraint iiif_metadata_pk_2
        unique (key, value, language, source, resource_id, site_id)
);

alter table iiif_metadata owner to madoc;

create index iiif_metadata_resource_id_index
    on iiif_metadata (resource_id);

create index iiif_metadata_structure_id_index
    on iiif_metadata (site_id);

create unique index iiif_metadata_uq
    on iiif_metadata (key, COALESCE(value, ''::text), language, source, resource_id, COALESCE(site_id, '-1'::integer));

create table iiif_resource_items
(
    resource_id integer not null
        constraint iiif_resource_items_iiif_resource_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    item_id integer not null
        constraint iiif_resource_items_iiif_item_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    item_index integer default 0 not null,
    constraint iiif_resource_items_pk
        primary key (resource_id, item_id)
);

alter table iiif_resource_items owner to madoc;



--iiif-tables (up)

-- Resources
create table iiif_resource
(
    id serial not null
        constraint iiif_resource_pk
            primary key,
    type text not null,
    source text,
    localsource text,
    rights text,
    viewingdirection integer default 0,
    navdate timestamp,
    height integer,
    width integer,
    duration float8,
    default_thumbnail text
);

alter table iiif_resource owner to madoc;

create unique index iiif_resource_source_uindex
    on iiif_resource (source);

create table iiif_resource_items
(
    resource_id int not null
        constraint iiif_resource_items_iiif_resource_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    item_id int not null
        constraint iiif_resource_items_iiif_item_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    item_index int default 0,
    constraint iiif_resource_items_pk
        primary key (resource_id, item_id, item_index)
);

alter table iiif_resource_items owner to madoc;

create table iiif_derivative
(
    id serial not null
        constraint iiif_derivative_pk
            primary key,
    type text not null,
    resource_id integer not null
        constraint iiif_derivative_iiif_resource_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    resource_index integer default 0 not null,
    context ltree
);

alter table iiif_derivative owner to madoc;

create table iiif_metadata
(
    id serial not null
        constraint iiif_metadata_pk
            primary key,
    key text not null,
    value text,
    language text default '@none'::text not null,
    source text not null,
    resource_id integer not null
        constraint iiif_metadata_iiif_resource_id_fk
            references iiif_resource
            on update cascade on delete cascade,
    structure_id integer
        constraint iiif_metadata_iiif_derivative_id_fk
            references iiif_derivative
            on update cascade on delete cascade,
    readonly boolean default false,
    edited boolean default false,
    auto_update boolean default true
);

alter table iiif_metadata owner to madoc;

create index iiif_metadata_resource_id_index
    on iiif_metadata (resource_id);

create index iiif_metadata_structure_id_index
    on iiif_metadata (structure_id);

create unique index iiif_metadata_uq
    on iiif_metadata (key, coalesce(value, ''), language, source, resource_id, coalesce(structure_id, -1));

create table iiif_collection
(
    column_1 serial not null
        constraint iiif_collection_pk
            primary key,
    label text
);

alter table iiif_collection owner to madoc;

create table iiif_collection_items
(
    collection_id integer not null,
    resource_id integer not null,
    derivative_id integer not null,
    item_index integer default 0 not null,
    constraint iiif_collection_items_pk
        primary key (collection_id, resource_id, derivative_id, item_index)
);

alter table iiif_collection_items owner to madoc;

--
-- Create resource
--
-- Basic Usage:
--
--   createResource('manifest', 'http://example.org/manifest.json', null, null);
--
-- Optionally automatically add derivative on a site. (siteId = 2)
--
--   createResource('manifest', 'http://example.org/manifest.json', 2, null);
--
-- Finally, the last parameter accepts JSON with mapped language strings:
-- {
--    "label": {
--       "en": ["Some value"],
--    }
-- }
--
create or replace function createResource(
    resourceType text,
    inputSource text,
    siteId int,
    metadata json
)
    returns int as
$id$
declare
    canonical_resource_id int;
    derivative_resource_id int;
begin
    -- Insert into resource, ignore conflict.
    insert into iiif_resource (type, source)
    values (resourceType, inputSource)
    on conflict do nothing;

    select id from iiif_resource ir where ir.type = resourceType and ir.source = inputSource into canonical_resource_id;

    if metadata is not null then
        perform addMetadata(metadata, canonical_resource_id, null);
    end if;

    if siteId is not null then
        insert into iiif_derivative (type, resource_id, context)
        values (resourceType, canonical_resource_id, ('site_' || siteId::text)::ltree)
        on conflict do nothing;

        if metadata is not null then
            select id
            from iiif_derivative ifd
            where ifd.type = resourceType
              and ifd.resource_id = canonical_resource_id
              and context = ('site_' || siteId::text)::ltree
            into derivative_resource_id;
            perform addMetadata(metadata, canonical_resource_id, derivative_resource_id);
        end if;
    end if;

    return canonical_resource_id;
end;
$id$ language plpgsql;

--
-- Add metadata
--
-- Format:
-- {
--    "label": {
--       "en": ["Some value"],
--    }
-- }
--
create or replace function addMetadata(
    test json,
    rid int,
    sid int
) returns boolean as
$id$
declare
    metadata_field RECORD;
    language_value RECORD;
    text_value     RECORD;
begin

    for metadata_field in select key, value from json_each(test)
        loop
            for language_value in select key, value from json_each(test::json -> metadata_field.key)
                loop
                    begin
                        for text_value in select json_array_elements_text(
                                                                 test::json -> metadata_field.key -> language_value.key) as text
                            loop
                                insert into iiif_metadata (key, value, source, language, resource_id, structure_id)
                                VALUES (metadata_field.key, text_value.text, 'iiif', language_value.key, rid, sid) on conflict do nothing;
                            end loop;
                    end;
                end loop;
        end loop;

    return true;
end;
$id$
    language plpgsql;


---
--- Derive manifest
---
create or replace function deriveManifest(
    rid int,
    sid int
) returns int as
$id$
declare
    canonical_resource_id int;
    derived_resource_id   int;
begin

    select id from iiif_resource where id = rid and type = 'manifest' into canonical_resource_id;

    insert into iiif_derivative (type, resource_id, context)
    values ('manifest', canonical_resource_id, ('site_' || sid::text)::ltree)
    on conflict do nothing;

    select id
    from iiif_derivative
    where type = 'manifest'
      and resource_id = canonical_resource_id
      and context = ('site_' || sid::text)::ltree
    into derived_resource_id;

    insert into iiif_derivative (type, resource_id, resource_index, context)
    select 'canvas'                                                                   as type,
           item_id                                                                    as resource_id,
           item_index                                                                 as resource_index,
           ('site_' || sid::text || '.manifest_' || derived_resource_id::text)::ltree as context
    from iiif_resource_items
    where resource_id = canonical_resource_id
    on conflict do nothing;

    insert into iiif_metadata (key, value, source, language, resource_id, structure_id)
    select im.key,
           im.value,
           im.source,
           im.language,
           im.resource_id,
           (select id
            from iiif_derivative iri
            where iri.resource_id = im.resource_id
              and context <@ ('site_' || sid::text)::ltree) as structure_id
    from iiif_metadata im
             left join iiif_resource_items iri on im.resource_id = iri.item_id
    where im.resource_id = canonical_resource_id
       or iri.resource_id = canonical_resource_id
    on conflict do nothing;


    return canonical_resource_id;

end;
$id$
    language plpgsql;
