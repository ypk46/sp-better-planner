import { defineConfig } from 'vite';
import { superProductivityPlugin } from './scripts/super-productivity-vite-plugin';

export default defineConfig({
  plugins: [
    superProductivityPlugin({
      inlineAssets: true,
      copyTo: process.env.SP_BUNDLED_PLUGINS_DIR,
    }),
  ],
});
