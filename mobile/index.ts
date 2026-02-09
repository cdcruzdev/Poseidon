// Polyfills - must be before everything else
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

// Crypto polyfill using expo-crypto
import * as ExpoCrypto from 'expo-crypto';
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {};
}
if (typeof globalThis.crypto.getRandomValues === 'undefined') {
  (globalThis.crypto as any).getRandomValues = (array: Uint8Array): Uint8Array => {
    const bytes = ExpoCrypto.getRandomBytes(array.length);
    array.set(bytes);
    return array;
  };
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
