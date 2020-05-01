import { RouteMiddleware } from '../types';
import { Vault } from '@hyperion-framework/vault';
import fetch from 'node-fetch';
import { createBackend } from '../i18n/i18next.server';

export const omekaHelloWorld: RouteMiddleware<{ slug: string }> = async context => {
  try {
    const [t] = await createBackend();
    const vault = new Vault();
    const json = await fetch('https://wellcomelibrary.org/iiif/b18035723/manifest').then(r => r.json());
    const manifest = await vault.loadManifest('https://wellcomelibrary.org/iiif/b18035723/manifest', json);
    context.omekaPage = `
    <h1>${t('Hello from Madoc!')}</h1>
    <p>${manifest.id}</p>
  `;
  } catch (err) {
    console.log(err);
  }
};
