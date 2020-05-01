import { sql, SqlSqlTokenType } from 'slonik';

export type GetMetadataRow = {
  resource_id: number;
  created_at: Date;
  key: string;
  value: string;
  language: string;
  source: string;
};

export const getMetadata = <T>(query: SqlSqlTokenType<T>, sid: number, keys?: string[]) => sql`
      select ifd.*,
             im.key,
             im.value,
             im.language,
             im.source
      from (${query}) ifd
               left join iiif_metadata im
                         on ifd.resource_id = im.resource_id
      where im.site_id = ${sid}
        ${keys ? sql`and im.key = ANY (${sql.array(keys, 'text')})` : sql``};
    `;
