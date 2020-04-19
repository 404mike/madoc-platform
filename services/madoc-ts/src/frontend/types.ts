import React from 'react';
import { ApiClient } from '../gateway/api';

export type UniversalComponent<Data, Params = {}, Query = {}> = React.FC<Data & Params> & {
  getData: (params: Params, api: ApiClient, queryString: Query) => Promise<Data>;
};

export type UniversalRoute = {
  path: string;
  exact?: boolean;
  component: UniversalComponent<any, any, any>;
};
