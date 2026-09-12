import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
// Isolated UI preview only. The production Vite config never loads these fixtures.
export default defineConfig({plugins:[react()],resolve:{alias:[{find:/^\.\.?\/auth$/,replacement:fileURLToPath(new URL('./fixtures/auth.js',import.meta.url))},{find:/^\.\.?\/firestore$/,replacement:fileURLToPath(new URL('./fixtures/firestore.js',import.meta.url))}]}});
