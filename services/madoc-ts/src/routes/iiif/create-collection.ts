import { RouteMiddleware } from '../../types';
import { InternationalString } from '@hyperion-framework/types';
import { ResourceItemSet } from '../../omeka/Resource';
import { fromInternationalString, url } from '../../utility/field-value';

type CreateCollectionBody = {
  collection: {
    label: InternationalString;
    summary?: InternationalString;
  };
  createdBy?: number;
  source?: string;
  siteId?: number;
};

export const createCollection: RouteMiddleware<{}, CreateCollectionBody> = async context => {
  if (!context.state.jwt || context.state.jwt.scope.indexOf('site.admin') === -1) {
    return;
  }

  const isUser = context.state.jwt && !context.state.jwt.user.service;
  const createdBy = isUser ? context.state.jwt.user.id : context.requestBody.createdBy;
  const siteId = isUser ? context.state.jwt.site.id : context.requestBody.siteId;
  const { collection, source } = context.requestBody;

  if (!createdBy) {
    return;
  }

  // Get site label
  const siteLabel = isUser ? context.state.jwt.site.name : await context.omeka.getSiteLabelById(siteId);

  context.response.body = await context.omeka.createItemFromTemplate(
    'IIIF Collection',
    ResourceItemSet,
    {
      'dcterms:title': fromInternationalString(collection.label),
      'dcterms:description': fromInternationalString(collection.summary),
      'dcterms:identifier': source ? [url(source, 'Collection URI')] : [],
      'dcterms:isPartOf': siteLabel && siteId ? [url(siteLabel, `urn:madoc:site:${siteId}`)] : [],
    },
    createdBy as number
  );
  context.response.status = 201;
};
