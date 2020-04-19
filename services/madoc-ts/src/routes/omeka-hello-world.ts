import { RouteMiddleware } from '../types';
import { Vault } from '@hyperion-framework/vault';
import fetch from 'node-fetch';

export const omekaHelloWorld: RouteMiddleware<{ slug: string }> = async context => {
  try {
    const vault = new Vault();
    const json = await fetch('https://wellcomelibrary.org/iiif/b18035723/manifest').then(r => r.json());
    const manifest = await vault.loadManifest('https://wellcomelibrary.org/iiif/b18035723/manifest', json);
    context.omekaPage = `
    <h1>Hello from Madoc</h1>
    <p>${manifest.id}</p>
  `;
  } catch (err) {
    console.log(err);
  }
};
