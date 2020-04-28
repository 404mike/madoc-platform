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

const apiGateway = process.env.API_GATEWAY as string;

export async function render({ url, basename, jwt }: { url: string; basename: string; jwt: string }) {
  const sheet = new ServerStyleSheet(); // <-- creating out stylesheet
  const api = new ApiClient(apiGateway, jwt);
  const context: StaticRouterContext = {};
  const ssrContext: any = {};
  const [urlPath, urlQuery] = url.split('?');
  const path = urlPath.slice(urlPath.indexOf(basename) + basename.length);
  let routeData = '';
  let matched = false;
  for (const route of routes) {
    const match = matchPath(path, route);
    if (match) {
      matched = true;
      const queryString = urlQuery ? parse(urlQuery) : {};
      const data = await route.component.getData(match.params, api, queryString);
      ssrContext.data = data;
      routeData = `<script type="application/json" data-react-route="${path}">${JSON.stringify(data)}</script>`;
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
      <SSRContext.Provider value={ssrContext}>
        <StaticRouter basename={basename} location={url} context={context}>
          <AdminApp api={api} />
        </StaticRouter>
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
