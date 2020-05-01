import { RouteMiddleware } from '../../../types';
import { sql } from 'slonik';
import { userWithScope } from '../../../utility/user-with-scope';
import { CreateCollection } from '../../../schemas/create-collection';

export const createCollection: RouteMiddleware<{}, CreateCollection> = async context => {
  const { siteId, userUrn } = userWithScope(context, ['site.admin']);

  const body = context.requestBody;
  const json = JSON.stringify(body.collection);

  // collection json, sid integer, extra_context text, added_by text
  const { canonical_id } = await context.connection.one<{ canonical_id: number; derived_id: number }>(
    sql`select * from create_collection(${json}, ${siteId}, null, ${userUrn})`
  );

  context.response.body = { id: canonical_id };
  context.response.status = 201;
};
