// Local browser fixture: sales are captured here without a database connection.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ManualSaleModal from '../src/dashboard/modals/ManualSaleModal.jsx';
import { prepareManualSaleOrders } from '../src/dashboard/saleOrder.js';
import { today } from '../src/dashboard/shared/dates.js';

const name = 'Pokemon Shrouded Fable Booster Bundle';
const stock = [58, 58, 58, 57.99, 57.99, 57.99].map((price, i) => ({
  id: `bundle-${i}`, name, price, size: 'OS', category: 'TCG',
  availability: 'available', purchaseLotId: `lot-${i % 4}`,
  purchaseSource: i % 2 ? 'JB Hi-Fi' : 'Other shop', purchaseDate: '2026-08-18',
}));
stock.push({ ...stock[0], id: 'preorder', availability: 'preorder' });

function ManualSaleFixture() {
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(null);
  return <main style={{ padding: 16 }}>
    <h1>Manual sale regression fixture</h1>
    <p>Six available bundles across four purchase lots, plus one preorder.</p>
    <button onClick={() => { setSaved(null); setOpen(true); }}>Open sale</button>
    {open && <ManualSaleModal inventory={stock} platforms={['Facebook Marketplace']} paymentMethods={['Cash']} customers={[]} onClose={() => setOpen(false)} onSell={(orders) => {
      let id = 0;
      const { entries } = prepareManualSaleOrders(orders, stock, () => `order-${++id}`, today());
      setSaved(entries.map(({ item, row, orderId }) => ({ id: item.id, cost: item.price, purchaseLotId: item.purchaseLotId, salePrice: row.salePrice, orderId })));
      setOpen(false);
      return { ok: true };
    }} />}
    {saved && <><h2>Captured sale units: {saved.length}</h2><pre>{JSON.stringify(saved, null, 2)}</pre></>}
  </main>;
}
createRoot(document.getElementById('root')).render(<ManualSaleFixture />);
