
import { Asset, AssetType } from '../types';

// Fallback Mock Data for assets that Tiantian Fund (Eastmoney) might not cover (e.g., specific US stocks, Crypto)
const FALLBACK_DB: Record<string, { name: string; price: number; type?: AssetType }> = {
  'QQQ': { name: 'Invesco QQQ', price: 445.00, type: AssetType.NASDAQ },
  'NVDA': { name: 'NVIDIA Corp', price: 920.00, type: AssetType.NASDAQ },
  'AAPL': { name: 'Apple Inc', price: 175.00, type: AssetType.NASDAQ },
  'BTC': { name: 'Bitcoin USD', price: 68000.00, type: AssetType.BITCOIN },
  'IBIT': { name: 'iShares Bitcoin Trust', price: 38.50, type: AssetType.BITCOIN },
};

interface TiantianResponse {
  fundcode: string;
  name: string;
  jzrq: string; // Net Value Date (Official)
  dwjz: string; // Unit Net Value (Official Final)
  gsz: string;  // Estimated Realtime Value (Intraday)
  gszzl: string; // Growth Rate
  gztime: string; // Estimate Time
}

// Global queue to handle JSONP requests sequentially because window.jsonpgz is a single global callback
let requestQueue: (() => Promise<void>)[] = [];
let isProcessingQueue = false;

const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;
  const task = requestQueue.shift();
  if (task) {
    try {
      await task();
    } catch (e) {
      console.warn("Queue task failed silently", e);
    }
  }
  isProcessingQueue = false;
  // Process next
  if (requestQueue.length > 0) processQueue();
};

const fetchFromTiantian = (code: string): Promise<{ name: string; price: number; isEstimate: boolean } | null> => {
  return new Promise((resolve) => {
    requestQueue.push(() => {
      return new Promise<void>((done) => {
        let isDone = false;
        const SCRIPT_TIMEOUT = 5000; // 5 seconds timeout

        // Cleanup helper
        const cleanup = () => {
          if (isDone) return;
          isDone = true;

          // Decouple callback
          if ((window as any).jsonpgz === callback) {
             (window as any).jsonpgz = () => {}; 
          }
          // Remove script
          if (script && document.body.contains(script)) {
            document.body.removeChild(script);
          }
          clearTimeout(timeoutId);
        };

        // Complete the task in the queue
        const complete = (result: any) => {
          cleanup();
          resolve(result);
          done();
        };

        // Safety timeout
        const timeoutId = setTimeout(() => {
          console.warn(`Timeout fetching code: ${code}`);
          complete(null);
        }, SCRIPT_TIMEOUT);

        const callback = (data: TiantianResponse) => {
          if (data) {
            const officialNav = parseFloat(data.dwjz);
            const estimatedNav = parseFloat(data.gsz);
            
            // Prioritize Real-time Estimate (gsz) for a "Live" feel.
            let price = 0;
            let isEstimate = false;

            if (!isNaN(estimatedNav) && estimatedNav > 0) {
              price = estimatedNav;
              isEstimate = true;
            } else if (!isNaN(officialNav) && officialNav > 0) {
              price = officialNav;
              isEstimate = false;
            }

            complete({
              name: data.name,
              price: price,
              isEstimate
            });
          } else {
            complete(null);
          }
        };

        // Tiantian hardcodes the callback name to 'jsonpgz'
        (window as any).jsonpgz = callback;

        const script = document.createElement('script');
        // Use HTTPS
        script.src = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
        
        script.onerror = () => {
          console.warn(`Script error fetching code: ${code}`);
          complete(null);
        };

        document.body.appendChild(script);
      });
    });
    processQueue();
  });
};

export const lookupAssetDetails = async (code: string): Promise<{ name: string; price: number } | null> => {
  if (!code) return null;
  
  // Normalize code: Tiantian API expects 6 digits (e.g., 518880). 
  // Strip common prefixes like sh/sz/of if user entered them.
  const normalizedCode = code.replace(/^(sh|sz|of)/i, '').trim();
  
  // 1. Try Tiantian Fund API (Best for CN Funds/ETFs)
  if (/^\d{6}$/.test(normalizedCode)) {
    try {
       const ttData = await fetchFromTiantian(normalizedCode);
       if (ttData && ttData.price > 0) {
         return { name: ttData.name, price: ttData.price };
       }
    } catch (e) {
       console.warn("Tiantian fetch failed", e);
    }
  }

  // 2. Fallback to local mock DB
  const dbEntry = FALLBACK_DB[normalizedCode.toUpperCase()];
  if (dbEntry) {
    return { name: dbEntry.name, price: dbEntry.price };
  }
  
  return null; 
};

export const fetchLatestPrices = async (assets: Asset[]): Promise<Record<string, number>> => {
  const newPrices: Record<string, number> = {};

  // Process sequentially to respect the JSONP queue limitations
  for (const asset of assets) {
    if (!asset.code) continue;

    // Small delay between requests to be polite to the API
    await new Promise(r => setTimeout(r, 100));

    const liveData = await lookupAssetDetails(asset.code);
    
    if (liveData && liveData.price > 0) {
      newPrices[asset.id] = liveData.price;
    } else {
       // Keep existing price if fetch fails
       newPrices[asset.id] = asset.currentPrice;
    }
  }

  return newPrices;
};
