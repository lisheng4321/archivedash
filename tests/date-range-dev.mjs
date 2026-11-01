// Local-only full-dashboard fixture. The data module is replaced before serving,
// so the browser cannot read or write a Supabase project.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const server = await createServer({
  configFile: false,
  envPrefix: 'DATE_RANGE_TEST_',
  plugins: [react(), {
    name: 'date-range-fixture-store',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/supabase.js')) return;
      return `
        export const supabase = null;
        export const isSupabaseConfigured = false;
        export const hasPendingSaves = () => false;
        export const hasNotesDraft = () => false;
        export const hasPendingSale = () => false;
        export const loadCloudNotes = async () => [];
        const sales = [
          { id: 'date-test-one', name: 'Date test sale', saleDate: '2026-10-02', salePrice: 100, costPrice: 40, shippingPrice: 0, platformFees: 0 },
          { id: 'date-test-two', name: 'Date test sale', saleDate: '2026-10-15', salePrice: 200, costPrice: 50, shippingPrice: 0, platformFees: 0 }
        ];
        export const load = async (key, fallback) => key === 'arch-sales2' ? sales : fallback;
        export const save = async () => ({ ok: true });
        export const saveInventorySale = async () => { throw new Error('Sales disabled in date fixture'); };
      `;
    },
  }],
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
await server.listen();
server.printUrls();
