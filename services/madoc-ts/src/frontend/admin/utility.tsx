import { QueryComponent, UniversalComponent } from '../types';
import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SSRContext, useApi } from './index';
import { parse } from 'query-string';
import { ApiClient } from '../../gateway/api';
import { QueryResult, useQuery } from 'react-query';

export const DataLoadingRoute: React.FC<{ component: UniversalComponent<any, any>; staticContext?: any }> = ({
  component: RouteComponent,
}) => {
  const api = useApi();
  const ssrStore = useContext(SSRContext);
  const [data, setData] = useState<any>(ssrStore ? ssrStore.data : undefined);
  const location = useLocation();
  const params = useParams();

  useEffect(() => {
    const dataEl = document.querySelector(`script[data-react-route="${location.pathname}"]`);

    if (dataEl && dataEl.textContent) {
      setData(JSON.parse(dataEl.textContent));
      if (dataEl.parentElement) {
        dataEl.parentElement.removeChild(dataEl);
      }
      return;
    }

    // Grab query string.
    const queryString = location.search ? parse(location.search) : {};

    // And render...
    RouteComponent.getData(params, api, queryString).then((d: any) => {
      setData(d);
    });
  }, [api, RouteComponent, location, params]);

  if (typeof data === 'undefined') {
    return null;
  }

  return <RouteComponent {...data} />;
};

export function createUniversalComponent<Data = any, TKey = any, TVariables = any>(
  Component: React.FC,
  options: {
    getKey: (params: any, query: any) => [TKey, TVariables];
    getData: (key: TKey, vars: TVariables, api: ApiClient) => Promise<Data>;
  }
): QueryComponent<Data, TKey, TVariables> {
  const ReturnComponent: any = Component;
  ReturnComponent.getKey = options.getKey;
  ReturnComponent.getData = options.getKey;
  return ReturnComponent;
}

export function useData<Data = any, TKey = any, TVariables = any>(
  component: QueryComponent<Data, TKey, TVariables>
): QueryResult<Data> {
  const api = useApi();
  const params = useParams();
  const location = useLocation();
  const key = component.getKey(params, location.search ? parse(location.search) : {});

  return useQuery(key as any, [api], component.getData as any);
}
