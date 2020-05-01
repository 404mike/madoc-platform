import React from 'react';
import { useTranslation } from 'react-i18next';
import { createUniversalComponent, usePaginatedData } from '../../../utility';
import { UniversalComponent } from '../../../../types';
import { LocaleString } from '../../../molecules/LocaleString';
import { CollectionFull } from '../../../../../schemas/collection-full';
import { Heading1, Subheading1 } from '../../../atoms/Heading1';
import { Pagination } from '../../../molecules/Pagination';
import { ButtonRow, TinyButton } from '../../../atoms/Button';
import { ImageGrid } from '../../../atoms/ImageGrid';
import { CroppedImage } from '../../../atoms/Images';
import { Heading5, Subheading5 } from '../../../atoms/Heading5';
import { ImageStripBox } from '../../../atoms/ImageStrip';

type CollectionViewType = {
  data: CollectionFull;
  query: { page?: number };
  params: { id: string };
  variables: { id: string; page: number };
};

export const CollectionView: UniversalComponent<CollectionViewType> = createUniversalComponent<CollectionViewType>(
  () => {
    const { t } = useTranslation();
    const { latestData, resolvedData, status } = usePaginatedData(CollectionView);

    if (status !== 'success' || !resolvedData) {
      return <div>loading...</div>;
    }

    const { collection, pagination } = resolvedData;

    return (
      <>
        <LocaleString as={Heading1}>{collection.label}</LocaleString>
        <Subheading1>{t('{{count}} manifests', { count: pagination.totalResults })}</Subheading1>
        <ButtonRow>
          <TinyButton>{t('edit')}</TinyButton>
          <TinyButton>{t('add manifest')}</TinyButton>
          <TinyButton>{t('edit metadata')}</TinyButton>
        </ButtonRow>

        <Pagination
          page={latestData ? latestData.pagination.page : 1}
          totalPages={latestData ? latestData.pagination.totalPages : 1}
          stale={!latestData}
        />

        <ImageGrid>
          {collection.items.map((manifest, idx) => (
            <ImageStripBox key={`${manifest.id}_${idx}`}>
              <CroppedImage>
                {manifest.thumbnail ? <img alt={t('First image in manifest')} src={manifest.thumbnail} /> : null}
              </CroppedImage>
              <LocaleString as={Heading5}>{manifest.label}</LocaleString>
              <Subheading5>{t('{{count}} images', { count: manifest.canvasCount })}</Subheading5>
            </ImageStripBox>
          ))}
        </ImageGrid>

        <Pagination
          page={latestData ? latestData.pagination.page : 1}
          totalPages={latestData ? latestData.pagination.totalPages : 1}
          stale={!latestData}
        />
      </>
    );
  },
  {
    async getData(key, vars, api) {
      return await api.request<any>(`/api/madoc/iiif/collections/${vars.id}?page=${vars.page}`);
    },
    getKey(params, query) {
      return ['collections', { id: params.id, page: query.page || 1 }];
    },
  }
);
