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

