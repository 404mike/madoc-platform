import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';

// @todo create manifest via source, check if already exists and just derive it if it does.
// @todo fix bug with create_manifest where multiple derived are inserted - probably missing index.
// @todo create from service (like queue) with user proxy.
export const createManifest: RouteMiddleware<{}> = async context => {
  const { userUrn, siteId } = userWithScope(context, ['site.admin']);

  const manifestJson = JSON.stringify(context.requestBody.manifest);
  const localSource = context.requestBody.local_source;

  const { canonical_id } = await context.connection.one<{ derived_id: number; canonical_id: number }>(
    sql`select * from create_manifest(${manifestJson}, ${
      localSource ? localSource : null
    }, ${siteId}, null, ${userUrn})`
  );

  context.response.body = { id: canonical_id };
  context.response.status = 201;
};
