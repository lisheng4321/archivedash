// Start with: node tests/date-range-dev.mjs
import React from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from '../src/Dashboard.jsx';
import '../src/dashboard/shared/appStyles.js';

if (import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Start the date-range fixture with an isolated envPrefix.');
}
createRoot(document.getElementById('root')).render(<Dashboard userEmail="Local date test" onLogout={() => {}} />);
