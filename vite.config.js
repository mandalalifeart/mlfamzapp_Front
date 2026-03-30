import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/report-request': {
        target: 'https://us-central1-mlfamzapp.cloudfunctions.net',
        changeOrigin: true,
        rewrite: () => '/MlfReportReq',
      },
      '/api/report-get': {
        target: 'https://us-central1-mlfamzapp.cloudfunctions.net',
        changeOrigin: true,
        rewrite: () => '/MlfReportGet',
      },
    },
  },
})