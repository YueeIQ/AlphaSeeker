import { Asset, AssetType } from '../types';

// Fallback Mock Data for assets that Tiantian Fund (Eastmoney) might not cover (e.g., specific US stocks, Crypto)
const FALLBACK_DB: Record<string, { name: string; price: number; type?: AssetType }> = {
  'QQQ': { name: 'Invesco QQQ', price: 445.00, type: AssetType.NASDAQ },
  'NVDA': { name: 'NVIDIA Corp', price: 920.00, type: AssetType.NASDAQ },
  'AAPL': { name: 'Apple Inc', price: 175.00, type: AssetType.NASDAQ },
  'BTC': { name: 'Bitcoin USD', price: 68000.00, type: AssetType.BITCOIN },
  'IBIT': { name: 'iShares Bitcoin Trust', price: 38.50, type: AssetType.BITCOIN },
};

// Global queue to handle requests sequentially.
// This is critical because the pingzhongdata interface sets global window variables.
// Running requests in parallel would cause race conditions where variables are overwritten.
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
        // Pingzhongdata files can be larger (historical data), so we allow a bit more time
        const SCRIPT_TIMEOUT = 8000; 

        const script = document.createElement('script');

        // Cleanup helper
        const cleanup = () => {
          if (isDone) return;
          isDone = true;

          // Remove script tag
          if (script && document.body.contains(script)) {
            document.body.removeChild(script);
          }
          
          // Clean up globals set by Eastmoney pingzhongdata script to avoid memory leaks
          try {
            delete (window as any).fS_name;
            delete (window as any).fS_code;
            delete (window as any).Data_netWorthTrend;
            delete (window as any).Data_ACWorthTrend;
            // Common other globals set by this interface
            delete (window as any).Data_grandTotal;
            delete (window as any).Data_rateInSimilarType;
            delete (window as any).Data_fluctuationScale;
            delete (window as any).Data_holderStructure;
            delete (window as any).Data_assetAllocation;
          } catch (e) {
            // ignore
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

        script.onload = () => {
          try {
            // 1. Get Fund Name
            const name = (window as any).fS_name;
            
            // 2. Get Net Worth Trend (Official NAV history)
            // Format: [{x: timestamp, y: nav, ...}, ...]
            const trend = (window as any).Data_netWorthTrend;

            if (name && Array.isArray(trend) && trend.length > 0) {
              // Latest official NAV
              const latest = trend[trend.length - 1];
              const price = parseFloat(latest.y);

              // Find Jan 1st price for YTD calculation
              const currentYear = new Date().getFullYear();
              const jan1st = new Date(currentYear, 0, 1).getTime();
              
              // Find the entry closest to Jan 1st (but not after)
              let basePrice = price; // Default to current if not found
              for (let i = 0; i < trend.length; i++) {
                if (trend[i].x >= jan1st) {
                  // Use the first entry of the year, or the one right before it if it's the very first
                  basePrice = parseFloat(trend[i].y);
                  break;
                }
                // Keep track of the last entry before Jan 1st as a fallback
                basePrice = parseFloat(trend[i].y);
              }

              if (!isNaN(price) && price > 0) {
                 complete({
                   name: name,
                   price: price,
                   basePrice: basePrice,
                   isEstimate: false
                 });
                 return;
              }
            }
            complete(null);
          } catch (err) {
            console.error("Error parsing pingzhongdata", err);
            complete(null);
          }
        };

        script.onerror = () => {
          console.warn(`Script error fetching code: ${code}`);
          complete(null);
        };

        // New URL for "Variety Data" (pingzhongdata)
        // Adding timestamp to prevent caching
        script.src = `https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`;
        
        document.body.appendChild(script);
      });
    });
    processQueue();
  });
};

export const lookupAssetDetails = async (code: string): Promise<{ name: string; price: number; basePrice?: number } | null> => {
  if (!code) return null;
  
  // Normalize code: Tiantian API expects 6 digits (e.g., 518880). 
  // Strip common prefixes like sh/sz/of if user entered them.
  const normalizedCode = code.replace(/^(sh|sz|of)/i, '').trim();
  
  // 1. Try Tiantian Fund API (Best for CN Funds/ETFs)
  if (/^\d{6}$/.test(normalizedCode)) {
    try {
       const ttData = await fetchFromTiantian(normalizedCode);
       if (ttData && ttData.price > 0) {
         return { name: ttData.name, price: ttData.price, basePrice: (ttData as any).basePrice };
       }
    } catch (e) {
       console.warn("Tiantian fetch failed", e);
    }
  }

  // 2. Fallback to local mock DB
  const dbEntry = FALLBACK_DB[normalizedCode.toUpperCase()];
  if (dbEntry) {
    return { name: dbEntry.name, price: dbEntry.price, basePrice: dbEntry.price };
  }
  
  return null; 
};

export const fetchLatestPrices = async (assets: Asset[]): Promise<Record<string, { price: number; basePrice?: number }>> => {
  const newPrices: Record<string, { price: number; basePrice?: number }> = {};

  // Process sequentially to respect the JSONP queue limitations
  for (const asset of assets) {
    if (!asset.code) continue;

    // Small delay between requests to be polite to the API
    await new Promise(r => setTimeout(r, 100));

    const liveData = await lookupAssetDetails(asset.code);
    
    if (liveData && liveData.price > 0) {
      newPrices[asset.id] = { price: liveData.price, basePrice: liveData.basePrice };
    } else {
       // Keep existing price if fetch fails
       newPrices[asset.id] = { price: asset.currentPrice, basePrice: asset.basePrice };
    }
  }

  return newPrices;
};