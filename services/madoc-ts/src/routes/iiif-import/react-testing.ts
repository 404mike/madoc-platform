import { RouteMiddleware } from '../../types';
import { render } from '../../frontend/iiif-import/server';

export const getReactPage: RouteMiddleware<{ slug: string }> = async context => {
  const bundle = context.routes.url('assets-bundles', { slug: context.params.slug, bundleId: 'iiif-import' });
  context.omekaPage = async token => `
      ${await render({ jwt: token })}
      <script type="application/javascript" src="${bundle}"></script>
    `;
};
