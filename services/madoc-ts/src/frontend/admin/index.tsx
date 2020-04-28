import React, { createContext, useContext } from 'react';
import { Link, Route, Switch } from 'react-router-dom';
import { routes } from './routes';
import { DataLoadingRoute } from './utility';
import { ApiClient } from '../../gateway/api';

export type AdminAppProps = {
  jwt?: string;
  api: ApiClient;
};

const ApiContext = createContext<ApiClient | undefined>(undefined);

export const useApi = () => {
  const api = useContext(ApiContext);

  if (!api) {
    throw new Error();
  }

  return api;
};

export const SSRContext = createContext<any>(undefined);

const AdminApp: React.FC<AdminAppProps> = ({ api }) => {
  return (
    <ApiContext.Provider value={api}>
      <h1>
        <Link to="/">Admin Dashboard</Link>
      </h1>
      <Switch>
        {routes.map(({ component, ...route }, key) => (
          <Route
            key={key}
            {...route}
            render={() => {
              return <DataLoadingRoute component={component} />;
            }}
          />
        ))}
        <Route path="/about">
          <div>About</div>
        </Route>
        <Route path="/dashboard">
          <div>Dashboard</div>
        </Route>
      </Switch>
    </ApiContext.Provider>
  );
};

export default AdminApp;
