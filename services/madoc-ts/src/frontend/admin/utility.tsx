import { UniversalComponent } from '../types';
import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { SSRContext, useApi } from './index';
import { parse } from 'query-string';

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
