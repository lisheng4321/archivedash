const DEF_CATEGORIES = ["Sneakers", "Apparel", "Accessories", "Collectables"];
const DEF_PLATFORMS = ["eBay AU", "StockX", "Facebook Marketplace", "Instagram", "Depop", "Discord", "GOAT", "CSFloat", "Bonusbank", "Other"];
const TIME_RANGES = ["1D", "1W", "1M", "MTD", "3M", "YTD", "1Y", "ALL", "Custom"];
const DEF_SIZE_MAP = {
  Sneakers: ["US 3","US 3.5","US 4","US 4.5","US 5","US 5.5","US 6","US 6.5","US 7","US 7.5","US 8","US 8.5","US 9","US 9.5","US 10","US 10.5","US 11","US 11.5","US 12","US 12.5","US 13","US 14","US 15"],
  Apparel: ["XXS","XS","S","M","L","XL","XXL"],
};
const getDefaultSize = (cat) => DEF_SIZE_MAP[cat]?.[0] || "OS";
const getSizes = (cat) => DEF_SIZE_MAP[cat] || ["OS"];
const EXP_CATEGORIES = ["Shipping & Fulfillment", "Botting Resources", "Cook Groups & Retail Memberships", "Matched Betting", "Software & Subs", "Inventory Parts", "Other"];
const SUB_CATEGORIES = ["Botting", "AI", "Marketplaces", "Domains", "Infrastructure", "Finance", "Other"];

const VERSION = "0.6.19";
const PREORDER_THRESHOLD = 40;
const FREQ_OPTIONS = ["weekly", "fortnightly", "monthly", "yearly", "custom"];
const FREQ_LABEL = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", yearly: "Yearly", custom: "Custom days" };
const CURRENCY_OPTIONS = ["AUD", "GBP", "EUR", "USD", "NZD", "JPY", "HKD", "CAD", "SGD"];
const EBAY_AU_FEE_RATE = 0.1177;
const EBAY_AU_FIXED_ORDER_FEE = 0.33;
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32];

const TEMPLATES = [
  {
    name: "Presale listing",
    body: `<b>Presale \u2014 \${date}</b><div>Item: </div><div>Source: </div><div>Cost per unit: AU$</div><div>Quantity: </div><div>Release date: </div><div>eBay title: </div><div><br></div><div><label><input type="checkbox"> AU comps researched</label></div><div><label><input type="checkbox"> Listing photos</label></div><div><label><input type="checkbox"> Listed on eBay</label></div><div><label><input type="checkbox"> Posted to FB groups</label></div><div><label><input type="checkbox"> Customer DMs sent</label></div><div><label><input type="checkbox"> Restock check</label></div>`,
  },
  {
    name: "Restock checklist",
    body: `<b>Restock \u2014 \${date}</b><div><br></div><div><label><input type="checkbox"> Diecast (Mini GT, Kaido House, Tarmac, Inno64)</label></div><div><label><input type="checkbox"> Pok\u00e9mon TCG sealed</label></div><div><label><input type="checkbox"> OPTCG presales</label></div><div><label><input type="checkbox"> Coins (presale + back catalogue)</label></div><div><label><input type="checkbox"> Update eBay storefront banners</label></div><div><label><input type="checkbox"> Refresh listing titles</label></div>`,
  },
  {
    name: "FB group post cluster",
    body: `<b>Post cluster \u2014 \${date}</b><div><br></div><div><label><input type="checkbox"> Pok\u00e9mon TCG groups</label></div><div><label><input type="checkbox"> Diecast groups</label></div><div><label><input type="checkbox"> AHUA Auctions</label></div><div><label><input type="checkbox"> OPTCG groups</label></div><div><label><input type="checkbox"> Coins groups</label></div><div><br></div><div>Caption: </div><div>Photos: </div><div>Pricing anchor: </div>`,
  },
  {
    name: "Customer order",
    body: `<b>Customer order</b><div>Customer: </div><div>Item: </div><div>Sale price: AU$</div><div>Platform: </div><div>Sale date: </div><div><br></div><div><label><input type="checkbox"> Payment received</label></div><div><label><input type="checkbox"> Packed</label></div><div><label><input type="checkbox"> Shipped</label></div><div><label><input type="checkbox"> Tracking sent</label></div><div><label><input type="checkbox"> Delivered</label></div><div><label><input type="checkbox"> Feedback left</label></div>`,
  },
  {
    name: "HK sourcing trip",
    body: `<b>HK Sourcing \u2014 targets</b><div><br></div><div><label><input type="checkbox"> HK Toycar Salon exclusives</label></div><div><label><input type="checkbox"> Tarmac / Inno64 store exclusives</label></div><div><label><input type="checkbox"> Pop Mart releases</label></div><div><label><input type="checkbox"> Pok\u00e9mon / OPTCG sealed</label></div><div><label><input type="checkbox"> BAPE HK exclusives</label></div><div><label><input type="checkbox"> Compare HKD vs AUD margins</label></div><div><label><input type="checkbox"> Negotiate multi-unit pricing</label></div>`,
  },
];

export {
  DEF_CATEGORIES,
  DEF_PLATFORMS,
  TIME_RANGES,
  DEF_SIZE_MAP,
  getDefaultSize,
  getSizes,
  EXP_CATEGORIES,
  SUB_CATEGORIES,
  VERSION,
  PREORDER_THRESHOLD,
  FREQ_OPTIONS,
  FREQ_LABEL,
  CURRENCY_OPTIONS,
  EBAY_AU_FEE_RATE,
  EBAY_AU_FIXED_ORDER_FEE,
  FONT_SIZES,
  TEMPLATES,
};
