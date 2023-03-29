import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        setupFiles: ['dotenv/config']
    },
    resolve: {
        alias: [{ find: '~', replacement: resolve(__dirname, 'src') }],
    },
});
