import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackStart({ /** Add your options here */ }),
    tailwindcss()
  ],
}) 