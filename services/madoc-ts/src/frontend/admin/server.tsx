// Fetch data
// Send data to component
// Render component to string
// Add inline script tag for bootstrapped data
import React from 'react';
import { renderToString } from 'react-dom/server';
import AdminApp, { SSRContext } from './index';
import { ServerStyleSheet } from 'styled-components';
import { StaticRouter, matchPath } from 'react-router-dom';
import { StaticRouterContext } from 'react-router';
import { routes } from './routes';
import { parse } from 'query-string';
import { ApiClient } from '../../gateway/api';
import { queryCache } from 'react-query';
import { I18nextProvider } from 'react-i18next';
import { createBackend } from '../../i18n/i18next.server';
import { i18n } from 'i18next';

const apiGateway = process.env.API_GATEWAY as string;

export async function render({
  url,
  basename,
  jwt,
  i18next,
}: {
  url: string;
  basename: string;
  jwt: string;
  i18next: i18n;
}) {
  const sheet = new ServerStyleSheet(); // <-- creating out stylesheet
  const api = new ApiClient(apiGateway, jwt);
  const context: StaticRouterContext = {};
  const [urlPath, urlQuery] = url.split('?');
  const path = urlPath.slice(urlPath.indexOf(basename) + basename.length);
  let routeData = '';
  let matched = false;
  const ssrData: any = {};
  for (const route of routes) {
    const match = matchPath(path, route);
    if (match) {
      matched = true;
      const queryString = urlQuery ? parse(urlQuery) : {};
      if (route.component.getKey && route.component.getData) {
        const [key, vars] = route.component.getKey(match.params, queryString);
        const data = await route.component.getData(key, vars, api);
        // Set the SSR context.
        ssrData.key = [key, vars];
        ssrData.data = data;
        routeData = `<script type="application/json" id="react-query-data" >${JSON.stringify(ssrData)}</script>`;
      }
      break;
    }
  }

  if (!matched) {
    return {
      type: 'redirect',
      status: 404,
    };
  }

  const markup = renderToString(
    sheet.collectStyles(
      <SSRContext.Provider value={ssrData}>
        <I18nextProvider i18n={i18next}>
          <StaticRouter basename={basename} location={url} context={context}>
            <AdminApp api={api} />
          </StaticRouter>
        </I18nextProvider>
      </SSRContext.Provider>
    )
  );

  if (context.url) {
    return {
      type: 'redirect',
      status: context.statusCode,
      to: context.url,
    };
  }

  const styles = sheet.getStyleTags(); // <-- getting all the tags from the sheet

  sheet.seal();

  return {
    type: 'document',
    html: `
    ${styles}
    <div id="admin-component">${markup}</div>
    <script crossorigin src="https://unpkg.com/whatwg-fetch@3.0.0/dist/fetch.umd.js"></script>
    <script crossorigin src="https://unpkg.com/react@16/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.development.js"></script>
    <script type="application/json" id="admin-data">${JSON.stringify({ basename })}</script>
    ${routeData}
  `,
  };
}
