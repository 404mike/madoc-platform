import React from 'react';
import { ApiClient } from '../gateway/api';

export type UniversalRoute = {
  path: string;
  exact?: boolean;
  component: QueryComponent;
};

export type UniversalComponent<
  Definition extends {
    data?: any;
    query?: any;
    params?: any;
    variables?: any;
  }
> = React.FC & {
  getData?: (key: string, vars: Definition['variables'], api: ApiClient) => Promise<Definition['data']>;
  getKey?: (params: Definition['params'], query: Definition['query']) => [string, Definition['variables']];
};

export type QueryComponent<Data = any, TKey = any, TVariables = any, Params = any, Query = any> = React.FC & {
  getKey?: (params: Params, query: Query) => [TKey, TVariables];
  getData?: (key: TKey, vars: TVariables, api: ApiClient) => Promise<Data>;
};
