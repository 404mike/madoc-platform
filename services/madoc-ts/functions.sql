create or replace function add_single_metadata(
    term text,
    language_map json,
    input_source text,
    rid int,
    sid int
) returns boolean as
$$
declare
    language_value RECORD;
    text_value     RECORD;
begin
    for language_value in select t.key, t.value from json_each(language_map) t
        loop
            begin
                for text_value in select json_array_elements_text(
                                                 language_map -> language_value.key) as text
                    loop
                        insert into iiif_metadata (key, value, source, language, resource_id, site_id)
                        VALUES (term, text_value.text, input_source, language_value.key, rid, sid)
                        on conflict do nothing;
                    end loop;
            end;
        end loop;
    return true;
end;
$$
    language plpgsql;

create or replace function add_metadata(
    test json,
    input_source text,
    rid int,
    sid int
) returns boolean as
$id$
declare
    metadata_field RECORD;
begin

    for metadata_field in select t.key, t.value from json_each(test) t
        loop
            perform add_single_metadata(metadata_field.key, metadata_field.value, input_source, rid, sid);
        end loop;

    return true;
end;
$id$
    language plpgsql;

create or replace function add_metadata_key_value_pairs(
    input_metadata json,
    resource_id int,
    site_id int,
    input_source text
) returns bool as
$id$
declare

begin
    for key in 0..(json_array_length(input_metadata) - 1)
        loop
        -- Save the metadata fields as metadata.0.label and metadata.0.value
        -- This is a special case in the de-serialisation, not ideal.
            perform add_single_metadata('metadata.' || (key)::text || '.label',
                                        input_metadata -> key -> 'label', input_source, resource_id, site_id);
            perform add_single_metadata('metadata.' || (key)::text || '.value',
                                        input_metadata -> key -> 'value', input_source, resource_id, site_id);
        end loop;

    return true;
end;
$id$ language plpgsql;

create or replace function derive_resource(
    canonical_resource_id int,
    sid int,
    input_context text
) returns int as
$id$
declare
    canonical_resource_type text;
    derived_resource_id     int;
    target_context          text;
begin
    target_context = 'site_' || sid;
    if input_context is not null then
        target_context = target_context || '.' || input_context;
    end if;

    select type from iiif_resource where id = canonical_resource_id into canonical_resource_type;

    insert into iiif_derivative (type, resource_id, context)
    values (canonical_resource_type, canonical_resource_id, target_context::ltree)
    on conflict do nothing;

    select id
    from iiif_derivative
    where type = canonical_resource_type
      and resource_id = canonical_resource_id
      and context = target_context::ltree
    into derived_resource_id;

    if canonical_resource_type = 'manifest' then
        -- Add the canvases if its a manifest.
        -- @todo same for collections OR generalised
        -- @todo when generalised, make recursive
        insert into iiif_derivative (type, resource_id, resource_index, context)
        select 'canvas'                                                             as type,
               item_id                                                              as resource_id,
               item_index                                                           as resource_index,
               (target_context || '.manifest_' || derived_resource_id::text)::ltree as context
        from iiif_resource_items
        where resource_id = canonical_resource_id
        on conflict do nothing;
    end if;

    insert into iiif_metadata (key, value, source, language, resource_id, site_id)
    select im.key,
           im.value,
           im.source,
           im.language,
           im.resource_id,
           sid as structure_id
    from iiif_metadata im
             left join iiif_resource_items iri on im.resource_id = iri.item_id
    where im.resource_id = canonical_resource_id
       or iri.resource_id = canonical_resource_id
    on conflict do nothing;

    return derived_resource_id;

end;
$id$
    language plpgsql;

create or replace function create_canvas(
    canvas json,
    local_source text,
    thumbnail text,
    sid int,
    extra_context text
)
    returns table
            (
                derived_id   int,
                canonical_id int
            )
as
$id$
declare
    -- Technical
    canvas_id                text;

    -- Descriptive.
    input_label              json;
    input_summary            json;
    input_metadata           json;
    input_required_statement json;

    -- Returns
    derived_id               int;
    canonical_id             int;

begin
    -- Grab the source ID
    canvas_id = (canvas ->> 'id')::text;
    -- iiif_resource.source

    -- Check for existing canvas resource
    select id from iiif_resource where source = canvas_id into canonical_id;

    -- We need to add it.
    if canonical_id is null then
        -- Descriptive
        select canvas -> 'label' into input_label; -- iiif_metadata
        select canvas -> 'summary' into input_summary; -- iiif_metadata
        select canvas -> 'metadata' into input_metadata; -- iiif_metadata (label + value)
        select canvas -> 'requiredStatement' into input_required_statement; -- iiif_metadata (label + value)

        insert into iiif_resource (type, source, localsource, rights, height, width,
                                   duration, default_thumbnail)
        select 'canvas'                              as type,
               (canvas ->> 'id')::text               as source,
               local_source                          as localsource,
               (canvas ->> 'rights')::text           as rights,
               -- canvas -> 'navDate'  as navdate, -- dates..
               (canvas ->> 'height')::int            as height,
               (canvas ->> 'width')::int             as width,
               (canvas ->> 'duration')::text::float8 as duration,
               thumbnail                             as default_thumbnail

               -- Populate canonical id with our new resource.
        returning id into canonical_id;

        if input_label is not null then
            perform add_single_metadata('label', input_label, 'iiif', canonical_id, null);
        end if;

        if input_summary is not null then
            perform add_single_metadata('summary', input_summary, 'iiif', canonical_id, null);
        end if;

        if input_metadata is not null then
            perform add_metadata_key_value_pairs(input_metadata, canonical_id, null, 'iiif');
        end if;

        if input_required_statement is not null then
            perform add_single_metadata('requiredStatement.label', input_required_statement -> 'label', 'iiif',
                                        canonical_id, null);
            perform add_single_metadata('requiredStatement.value', input_required_statement -> 'value', 'iiif',
                                        canonical_id, null);
        end if;

    end if;

    if sid is not null then
        -- Derive Canvas.
        derived_id = derive_resource(canonical_id, sid, extra_context);
    end if;

    return query select derived_id, canonical_id;
end;
$id$ language plpgsql;

-- Create manifest
-- This is not a whole import of the canvases. It is expected that the resources will be linked later.
create or replace function create_manifest(
    manifest json,
    local_source text,
    sid int,
    extra_context text
)
    returns table
            (
                derived_id   int,
                canonical_id int
            )
as
$id$
declare
    manifest_id              text;
    input_label              json;
    input_summary            json;
    input_metadata           json;
    input_required_statement json;
    input_viewing_direction  text;
    viewing_direction        int;
    -- return
    canonical_id             int;
    derived_id               int;
begin
    -- Grab the source ID
    manifest_id = (manifest ->> 'id')::text;
    -- iiif_resource.source

    -- Check for existing canvas resource
    select id from iiif_resource where source = manifest_id into canonical_id;

    -- We need to add it.
    if canonical_id is null then
        -- Descriptive
        input_label = manifest -> 'label'; -- iiif_metadata
        input_summary = manifest -> 'summary'; -- iiif_metadata
        input_metadata = manifest -> 'metadata'; -- iiif_metadata (label + value)
        input_required_statement = manifest -> 'requiredStatement'; -- iiif_metadata (label + value)
        input_viewing_direction = manifest ->> 'viewingDirection';


        case
            when input_viewing_direction = 'left-to-right' then viewing_direction = 0;
            when input_viewing_direction = 'right-to-left' then viewing_direction = 1;
            when input_viewing_direction = 'top-to-bottom' then viewing_direction = 2;
            when input_viewing_direction = 'bottom-to-top' then viewing_direction = 3;
            else viewing_direction = 0;
            end case;

        insert into iiif_resource (type, source, localsource, rights, viewingdirection)
        select 'manifest'                    as type,
               (manifest ->> 'id')::text     as source,
               local_source                  as localsource,
               (manifest ->> 'rights')::text as rights,
               viewing_direction             as viewingdirection
               -- Populate canonical id with our new resource.
        returning id into canonical_id;

        if input_label is not null then
            perform add_single_metadata('label', input_label, 'iiif', canonical_id, null);
        end if;

        if input_summary is not null then
            perform add_single_metadata('summary', input_summary, 'iiif', canonical_id, null);
        end if;

        if input_metadata is not null then
            perform add_metadata_key_value_pairs(input_metadata, canonical_id, null, 'iiif');
        end if;

        if input_required_statement is not null then
            perform add_single_metadata('requiredStatement.label', input_required_statement -> 'label', 'iiif',
                                        canonical_id, null);
            perform add_single_metadata('requiredStatement.value', input_required_statement -> 'value', 'iiif',
                                        canonical_id, null);
        end if;

    end if;

    if sid is not null then
        -- Derive manifest.
        derived_id = derive_resource(canonical_id, sid, extra_context);
    end if;

    return query select derived_id, canonical_id;
end;
$id$ language plpgsql;

create or replace function create_collection(
    collection json,
    sid int,
    extra_context text
)
    returns table
            (
                derived_id   int,
                canonical_id int
            )
as
$id$
declare
    collection_id  text;
    input_label    json;
    input_summary  json;
    input_metadata json;
    -- return
    canonical_id   int;
    derived_id     int;
begin
    -- Grab the source ID
    collection_id = (collection ->> 'id')::text;
    -- iiif_resource.source

    -- Check for existing canvas resource
    select id from iiif_resource where source = collection_id into canonical_id;

    if canonical_id is null then
        -- Descriptive
        input_label = collection -> 'label'; -- iiif_metadata
        input_summary = collection -> 'summary'; -- iiif_metadata
        input_metadata = collection -> 'metadata'; -- iiif_metadata (label + value)

        insert into iiif_resource (type, source)
        select 'collection'                as type,
               (collection ->> 'id')::text as source
               -- Populate canonical id with our new resource.
        returning id into canonical_id;

        if input_label is not null then
            perform add_single_metadata('label', input_label, 'iiif', canonical_id, null);
        end if;

        if input_summary is not null then
            perform add_single_metadata('summary', input_summary, 'iiif', canonical_id, null);
        end if;

        if input_metadata is not null then
            perform add_metadata_key_value_pairs(input_metadata, canonical_id, null, 'iiif');
        end if;
    end if;

    if sid is not null then
        -- Derive Collection.
        derived_id = derive_resource(canonical_id, sid, extra_context);
    end if;

    return query select derived_id, canonical_id;
end
$id$ language plpgsql;

create or replace function remove_item_context(
    sid int,
    resource_type text,
    rid int,
    item_type text,
    item_id int
) returns boolean as
$$
declare
    direct_resource lquery;
    sub_resources   lquery;
begin
    direct_resource = ('site_' || sid || '.*.' || resource_type || '_' || rid)::lquery;
    sub_resources = (direct_resource::text || '.' || item_type || '_' || item_id)::lquery;

    delete
    from iiif_derivative
    where (context ~ direct_resource and resource_id = item_id)
       or context ~ sub_resources;

    return true;
end
$$ language plpgsql;

create or replace function add_item_context(
    sid int,
    resource_type text,
    rid int,
    item_type text,
    item_ids int[]
) returns boolean as
$$
declare
    context_to_add ltree;
    site           ltree;
    resource       ltree;
    item_urn       ltree;
    item_id        int;
begin
    site = ('site_' || sid::text)::ltree;
    resource = (resource_type || '_' || rid::text)::ltree;

    for context_to_add in select context
                          from iiif_derivative ird
                          where ird.resource_id = rid
                            and ird.context <@ site
        loop
            insert into iiif_derivative (type, resource_id, resource_index, context)
            select item_type                                                as type,
                   item.id                                                  as resource_id,
                   array_position(item_ids, item.id)                        as resource_index,
                   (context_to_add || (resource_type || '_' || rid)::ltree) as context
            from iiif_resource item
            where id = ANY (item_ids)
            on conflict do nothing;

            foreach item_id in array item_ids
                loop
                    item_urn = (item_type || '_' || item_id::text)::ltree;

                    insert into iiif_derivative (type, resource_id, resource_index, context)
                    select ifd.type                                                             as type,
                           ifd.resource_id                                                      as resource_id,
                           ifd.resource_index                                                   as resource_index,
                           (
                                       subpath(ifd.context, 0, index(ifd.context, item_urn))
                                       || resource
                                   || subpath(ifd.context, index(ifd.context, item_urn))::text) as context
                    from iiif_derivative ifd
                    where context ~ (site::text || '.*.' || item_urn::text || '.*')::lquery
                      and (context ~ ('*.' || resource_type || '_*.*')::lquery) = false;
                end loop;

        end loop;

    return true;
end
$$ language plpgsql;

create or replace function add_canvases_to_manifest(
    site_id int,
    manifest_id int,
    canvas_ids int[]
) returns boolean as
$$
declare
    site_urn           text;
    canvas_ids_json    json;
    canvas_id          int;
    derivative_id      int;
    derived_canvas_ids int[];
    derived_canvas_id  int;
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

    if site_id is not null then
        -- Set up our site urn.
        site_urn = 'site_' || site_id;
        -- We need the derived manifest id.
        -- There are 2 things we need to do.
        -- Either create the derived resources for the canvases
        -- Or add the canvas to the manifest.

        raise notice 'Adding to site id %', site_urn;


        -- First we get our manifest id for the derived resource.
        select id
        from iiif_derivative
        where resource_id = manifest_id
          and context <@ site_urn::ltree
        into derivative_id;

        -- Now instead of updating this directly, we need to consider cases
        -- where manifests are inside of collections or other cases. What we need
        -- is to build up a call to
        --
        --      add_item_context(
        --          site_id,
        --          'manifest',
        --          manifest_id,
        --          canvas_ids
        --      )

        derived_canvas_ids = array []::int[];

        for key in 0..(array_length(canvas_ids, 1) - 1)
            loop
                canvas_id = canvas_ids_json -> key;

                -- We want to find canvas in the site with a matching ID
                select id
                from iiif_derivative
                where type = 'canvas'
                  and resource_id = canvas_id
                  and context ~ (site_urn::text || '.*')::lquery
                into derived_canvas_id;

                if derived_canvas_id is null then
                    raise notice 'Did not found derived canvas, adding new one...';
                    -- We will get to this.
                    perform derive_resource(canvas_id, site_urn || '.manifest_' || derivative_id);
                end if;

                if (canvas_id = ANY (derived_canvas_ids)) = false then
                    derived_canvas_ids = array_append(derived_canvas_ids, canvas_id);
                end if;

            end loop;

        raise notice 'Found derived canvas_ids %', derived_canvas_ids;

        -- At this point we have a hopefully complete list of derived_canvas_ids[]
        -- We can now run the add_item_context
        if array_length(derived_canvas_ids, 1) > 0 then
            perform add_item_context(
                    site_id,
                    'manifest',
                    manifest_id,
                    'canvas',
                    derived_canvas_ids
                );
        else
            raise notice 'Did not find any canvas ids.';
        end if;
    end if;

    return true;
end;
$$ language plpgsql;

create or replace function add_manifests_to_collection(
    site_id int,
    collection_id int,
    manifest_ids int[]
) returns boolean as
$$
declare
    site_urn             text;
    manifest_ids_json    json;
    manifest_id          int;
    derivative_id        int;
    derived_manifest_ids int[];
    derived_manifest_id  int;
begin
    manifest_ids_json = to_json(manifest_ids);

    -- We want to get the order of these..
    for key in 0..(array_length(manifest_ids, 1) - 1)
        loop
            manifest_id = manifest_ids_json -> key;
            insert into iiif_resource_items (item_id, resource_id, item_index)
            select manifest_id   as item_id,
                   collection_id as resource_id,
                   key           as item_index
            on conflict (resource_id, item_id) do update set item_index = key;
        end loop;


    -- This is where we got stuck.
    -- Now we have enough to add the derivatives.
    -- Collections are slightly different, they are managed per site, you shouldn't NOT use a site
    -- for managing a collection and you shouldn't share them across sites.
    -- To get the derivatives.
    --    -> Make sure each manifest is in the site, if not derive it.
    --    -> Get a list of the derived ids
    --    -> make call:
    --
    --     perform add_item_context(
    --         site_id,
    --         'collection',
    --         collection_id,
    --         derived_manifest_ids
    --     );
    if site_id is not null then
        -- Set up our site urn.
        site_urn = 'site_' || site_id;
        -- We need the derived manifest id.
        -- There are 2 things we need to do.
        -- Either create the derived resources for the canvases
        -- Or add the canvas to the manifest.


        -- First we get our manifest id for the derived resource.
        select id
        from iiif_derivative
        where resource_id = manifest_id
          and context <@ site_urn::ltree
        into derivative_id;

        -- Now instead of updating this directly, we need to consider cases
        -- where manifests are inside of collections or other cases. What we need
        -- is to build up a call to
        --
        --      add_item_context(
        --          site_id,
        --          'manifest',
        --          manifest_id,
        --          canvas_ids
        --      )

        derived_manifest_ids = array []::int[];

        for key in 0..(array_length(manifest_ids, 1) - 1)
            loop
                manifest_id = manifest_ids_json -> key;

                -- We want to find canvas in the site with a matching ID
                select resource_id
                from iiif_derivative
                where type = 'manifest'
                  and resource_id = manifest_id
                  and context <@ site_urn::ltree
                into derived_manifest_id;

                if derived_manifest_id is null then
                    raise notice 'Did not found derived manifest, adding: %', manifest_id;
                    -- We will get to this.
                    perform derive_resource(manifest_id, site_urn || '.collection_' || derivative_id);
                end if;

                if (manifest_id = ANY (derived_manifest_ids)) = false then
                    derived_manifest_ids = array_append(derived_manifest_ids, manifest_id);
                end if;
            end loop;

        -- At this point we have a hopefully complete list of derived_canvas_ids[]
        -- We can now run the add_item_context
        if array_length(derived_manifest_ids, 1) > 0 then
            perform add_item_context(
                    site_id,
                    'collection',
                    collection_id,
                    'manifest',
                    derived_manifest_ids
                );
        else
            raise notice 'Did not find any manifest ids.';
        end if;
    end if;

    return true;
end;
$$ language plpgsql;

create or replace function reorder_context(
    sid int,
    item_type text,
    item_id int,
    ids int[]
) returns boolean as
$$
declare
    search_query lquery;
begin

    search_query = ('site_' || sid::text || '.*.' || item_type || '_' || item_id::text)::lquery;

    update iiif_derivative ird
    set resource_index = array_position(ids, ird.resource_id)
    where ird.resource_id = ANY (ids)
      and context ~ search_query;

    return true;
end
$$ language plpgsql;

create or replace function update_metadata_field(
    input_resource_id int,
    input_key text,
    input_language text,
    input_source text,
    input_value text,
    sid int
) returns boolean as
$$
declare
begin

    if sid is not null then
        -- Update both the canonical AND any site ones that match
        update iiif_metadata im
        set value       = input_value,
            edited      = true,
            readonly    = false,
            auto_update = false
            where im.resource_id = input_resource_id
                and im.site_id = sid
                and im.key = input_key
                and im.source = input_source
                and im.language = input_language;

        return true;
    end if;


    update iiif_metadata im
    set value       = input_value
    where im.resource_id = input_resource_id
      and im.key = input_key
      and im.source = input_source
      and im.language = input_language
     and (
         (im.site_id is null) or (
             im.auto_update = true and im.edited = false
            )
        );

    return true;
end
$$ language plpgsql;


---
--- Utility
---

create or replace function remove_from_subpath(
    input ltree[],
    to_remove ltree
) returns ltree[] as
$$
declare
    item           ltree;
    candidate_path ltree;
    return_arr     ltree[];
begin

    return_arr = array []::ltree[];

    foreach item in array input
        loop
            if (item ~ ('*.' || to_remove::text || '.*')::lquery) then

                raise notice 'nlevel % %, %', item, 1 + index(item, to_remove), nlevel(item);

                if (1 + index(item, to_remove)) = nlevel(item) then
                    candidate_path = subpath(item, 0, index(item, to_remove));
                else
                    candidate_path = (subpath(item, 0, index(item, to_remove)) ||
                                      subpath(item, 1 + index(item, to_remove)));
                end if;

                if (candidate_path = ANY (return_arr)) = false then
                    return_arr = array_append(return_arr, candidate_path);
                end if;
            else
                if (item = ANY (return_arr)) = false then
                    return_arr = array_append(return_arr, item);
                end if;
            end if;
        end loop;

    return return_arr;
end;
$$ language plpgsql;

create or replace function context_to_query(
    arr ltree[], leaf text
)
    returns lquery[] as
$$
declare
    return_arr lquery[];
    item       ltree;
begin
    return_arr = (ARRAY [])::lquery[];

    foreach item in array arr
        loop
            return_arr = return_arr || array [(item::text || '.' || leaf)::lquery];
        end loop;

    return return_arr;

end;
$$ language plpgsql;

create or replace function merge_ltree_array(
    arr1 ltree[],
    arr2 ltree[]
) returns ltree[] as
$$
declare
    return_arr ltree[];
    item       ltree;
begin
    return_arr = ARRAY []::ltree[];

    raise notice 'Merging context 1: %', arr1;
    raise notice 'Merging context 2: %', arr2;

    foreach item in array arr2
        loop
            -- if they are equal.
            if arr1 ~ (item::text)::lquery then
                -- skip for now.
            elseif arr1 <@ (item) then
                -- skip.
            else
                return_arr = return_arr || item;
            end if;
        end loop;

    foreach item in array arr1
        loop
            -- if they are equal.
            if arr2 ~ (item::text)::lquery then
                -- Need to add at least one.
                return_arr = return_arr || item;
            elseif arr2 <@ (item) then
                -- skip.
            else
                return_arr = return_arr || item;
            end if;
        end loop;

    raise notice 'Merging context result: %', return_arr;

    return return_arr;
end;
$$ language plpgsql;
