import { InternationalString } from '@hyperion-framework/types';

export type MetadataField = {
  resource_id: number;
  key: string;
  value: string;
  language: string;
  source: string;
  thumbnail?: string;
  created_at?: Date;
};

export const metadataReducer = (acc: any, next: MetadataField) => {
  if (!acc[next.resource_id]) {
    acc[next.resource_id] = {
      id: next.resource_id,
      created: next.created_at,
      thumbnail: next.thumbnail,
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
};

export function mapMetadata<
  T extends any = {
    [key: string]: InternationalString | Array<{ label: InternationalString; value: InternationalString }>;
  }
>(fields: MetadataField[]): T[] {
  return Object.values(fields.reduce<any>(metadataReducer, {})) as T[];
}
