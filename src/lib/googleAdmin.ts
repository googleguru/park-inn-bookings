import { api, ApiError } from './api';

const flowKey = 'parkinn.google-flow';
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

type GoogleConfig = { clientId: string; redirectUri: string };

export async function getGoogleConfig(): Promise<GoogleConfig | null> {
  try {
    return await api<GoogleConfig>('googleAdminConfig');
  } catch (err) {
    if (err instanceof ApiError && err.code === 'CONFIG') return null;
    throw err;
  }
}

export async function startGoogleAdmin({ clientId, redirectUri }: GoogleConfig) {
  const state = encode(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(flowKey, JSON.stringify({ state, verifier, started: Date.now() }));
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid email', prompt: 'select_account', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  location.assign(url.href);
}

export function takeGoogleReturn() {
  const query = new URLSearchParams(location.search);
  if (!query.has('state') || !(query.has('code') || query.has('error'))) return null;
  history.replaceState(null, '', location.pathname + '#/admin');
  const saved = sessionStorage.getItem(flowKey);
  sessionStorage.removeItem(flowKey);
  const flow = saved && JSON.parse(saved);
  if (!flow || flow.state !== query.get('state') || Date.now() - flow.started > 600000)
    return { error: 'Your sign-in request expired. Please try again.' };
  if (query.has('error')) return { error: 'Google sign-in was cancelled.' };
  return { code: query.get('code')!, verifier: String(flow.verifier) };
}

let pendingReturn = takeGoogleReturn();
export function consumeGoogleReturn() {
  const result = pendingReturn;
  pendingReturn = null;
  return result;
}
