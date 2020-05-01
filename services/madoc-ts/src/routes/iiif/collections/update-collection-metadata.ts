import { RouteMiddleware } from '../../../types';

export const updateCollectionMetadata: RouteMiddleware = async context => {
  // @todo abstraction over metadata updating.
  // 1. Convert input into rows.
  // 2. Fetch existing fields.
  // 3. Compile list of deletions
  // 4. Compile list of updates
  // 5. Compile list of inserts
};
