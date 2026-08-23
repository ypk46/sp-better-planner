import type { PluginAPI as PluginAPIType } from '@super-productivity/plugin-api';

declare global {
  const PluginAPI: PluginAPIType;
}

export {};
