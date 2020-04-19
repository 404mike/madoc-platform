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
      <h1>Admin app.</h1>
      <div>
        <ul>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/about">About</Link>
          </li>
          <li>
            <Link to="/dashboard">Dashboard</Link>
          </li>
          <li>
            <Link to="/collections/abc">Collection ABC</Link>
          </li>
          <li>
            <Link to="/collections/def">Collection DEF</Link>
          </li>
        </ul>

        <hr />

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
      </div>
    </ApiContext.Provider>
  );
};

export default AdminApp;
