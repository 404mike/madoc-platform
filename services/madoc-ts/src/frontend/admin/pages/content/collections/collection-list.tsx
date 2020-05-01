import React from 'react';
import { createUniversalComponent, usePaginatedData } from '../../../utility';
import { ButtonRow, TinyButton } from '../../../atoms/Button';
import { Heading3, Subheading3 } from '../../../atoms/Heading3';
import { ImageStrip, ImageStripBox } from '../../../atoms/ImageStrip';
import { CroppedImage } from '../../../atoms/Images';
import { Heading5, Subheading5 } from '../../../atoms/Heading5';
import { MoreContainer, MoreDot, MoreIconContainer, MoreLabel } from '../../../atoms/MoreButton';
import { useTranslation } from 'react-i18next';
import { UniversalComponent } from '../../../../types';
import { Pagination } from '../../../molecules/Pagination';
import { LocaleString } from '../../../molecules/LocaleString';
import { CollectionListResponse } from '../../../../../schemas/collection-list';
import { Link } from 'react-router-dom';

type CollectionListType = {
  data: CollectionListResponse;
  params: {};
  query: { page: number };
  variables: { page: number };
};

export const CollectionList: UniversalComponent<CollectionListType> = createUniversalComponent<CollectionListType>(
  () => {
    const { status, resolvedData: data, latestData } = usePaginatedData(CollectionList);
    const { t } = useTranslation();
    // const isRefreshing = !latestData;

    if (status === 'loading' || status === 'error' || !data) {
      return <div>{t('Loading')}</div>;
    }

    return (
      <>
        <h1>{t('Manage collections', { count: data.pagination.totalResults })}</h1>
        <TinyButton as={Link} to={`/import/collection`}>
          {t('Import collection')}
        </TinyButton>
        <div>
          <Pagination
            page={latestData ? latestData.pagination.page : 1}
            totalPages={latestData ? latestData.pagination.totalPages : 1}
            stale={!latestData}
          />
        </div>
        {data.collections.map((collection, idx) => (
          <div key={idx} style={{ marginBottom: 80 }}>
            <Heading3>
              <LocaleString as={Link} to={`/collections/${collection.id}`}>
                {collection.label}
              </LocaleString>
            </Heading3>
            <ButtonRow>
              <TinyButton as={Link} to={`/collections/${collection.id}/structure`}>
                {t('edit')}
              </TinyButton>
              <TinyButton as={Link} to={`/collections/${collection.id}/import`}>
                {t('add manifest')}
              </TinyButton>
              <TinyButton as={Link} to={`/collections/${collection.id}/metadata`}>
                {t('edit metadata')}
              </TinyButton>
            </ButtonRow>
            <Subheading3>{t('{{count}} Manifests', { count: collection.manifestCount })}</Subheading3>
            {collection.items.length === 0 ? null : (
              <ImageStrip>
                {collection.items.map((manifest, key) => (
                  <Link to={`/manifests/${manifest.id}`} key={key}>
                    <ImageStripBox>
                      <CroppedImage>
                        {manifest.thumbnail ? (
                          <img alt={t('First image in manifest')} src={manifest.thumbnail} />
                        ) : null}
                      </CroppedImage>
                      <LocaleString as={Heading5}>{manifest.label}</LocaleString>
                      <Subheading5>{t('{{count}} images', { count: manifest.canvasCount })}</Subheading5>
                    </ImageStripBox>
                  </Link>
                ))}
                {collection.items.length < (collection.manifestCount || collection.items.length) ? (
                  <div>
                    <Link to={`/collections/${collection.id}`}>
                      <MoreContainer>
                        <MoreIconContainer>
                          <MoreDot />
                          <MoreDot />
                          <MoreDot />
                        </MoreIconContainer>
                        <MoreLabel>
                          {t('{{count}} more', {
                            count: (collection.manifestCount || collection.items.length) - collection.items.length,
                          })}
                        </MoreLabel>
                      </MoreContainer>
                    </Link>
                  </div>
                ) : null}
              </ImageStrip>
            )}
          </div>
        ))}
        <Pagination
          page={latestData ? latestData.pagination.page : 1}
          totalPages={latestData ? latestData.pagination.totalPages : 1}
          stale={!latestData}
        />
      </>
    );
  },
  {
    getData: async (key, vars, api) => {
      return await api.request<CollectionListResponse>(`/api/madoc/iiif/collections?page=${vars.page || 1}`);
    },
    getKey(params, query) {
      return ['collections', { page: query.page }];
    },
  }
);
