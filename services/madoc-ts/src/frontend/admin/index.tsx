import React, { createContext, useContext, useMemo } from 'react';
import { Link, Route, Switch } from 'react-router-dom';
import { routes } from './routes';
import { ApiClient } from '../../gateway/api';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();

  const viewingDirection = useMemo(() => i18n.dir(i18n.language), [i18n.language]);

  return (
    <div lang={i18n.language} dir={viewingDirection}>
      <ApiContext.Provider value={api}>
        <h1>
          <Link to="/">Admin Dashboard</Link>
        </h1>
        <Switch>
          {routes.map(({ component: Component, ...route }, key) => (
            <Route
              key={key}
              {...route}
              render={() => {
                return <Component />;
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
    </div>
  );
};

export default AdminApp;
