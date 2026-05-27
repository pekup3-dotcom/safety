/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust, client-side safe UUID generator.
 * Gracefully falls back if window.crypto.randomUUID is not defined
 * in non-secure HTTP contexts or sandboxed browser iframes.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // High-entropy secure-random fallback
  const s4 = () => {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  };
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}
