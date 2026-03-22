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

const fetchUSStock = async (code: string): Promise<{ name: string; price: number; basePrice?: number; currency?: 'CNY' | 'USD' } | null> => {
  // 1. Try Tencent Finance (Fastest and most reliable for US Stocks)
  try {
    const tencentResult = await new Promise<{ name: string; price: number; basePrice?: number; currency?: 'CNY' | 'USD' } | null>((resolve) => {
      const script = document.createElement('script');
      script.charset = 'gbk';
      const upperCode = code.toUpperCase();
      const varName = `v_us${upperCode}`;
      
      script.src = `https://qt.gtimg.cn/q=us${upperCode}`;
      
      script.onload = () => {
        try {
          const data = (window as any)[varName];
          if (data && !data.includes('v_pv_none_match')) {
            const parts = data.split('~');
            if (parts.length > 3) {
              const name = parts[1];
              const price = parseFloat(parts[3]);
              const prevClose = parseFloat(parts[4]);
              
              if (!isNaN(price) && price > 0) {
                resolve({
                  name: name || upperCode,
                  price: price,
                  basePrice: prevClose || price,
                  currency: 'USD'
                });
                return;
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to parse Tencent Finance data for ${code}`, e);
        } finally {
          if (script.parentNode) {
            document.body.removeChild(script);
          }
          delete (window as any)[varName];
        }
        resolve(null);
      };
      
      script.onerror = () => {
        if (script.parentNode) {
          document.body.removeChild(script);
        }
        resolve(null);
      };
      
      document.body.appendChild(script);
    });
    
    if (tencentResult) return tencentResult;
  } catch (e) {
    console.warn("Tencent Finance fetch failed", e);
  }

  // 2. Fallback to Yahoo Finance (For Crypto or unsupported stocks)
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}?range=ytd&interval=1d`;
    let response;
    
    // Try direct fetch first (fastest, but might fail due to CORS in some environments)
    try {
      const directUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${code}?range=ytd&interval=1d`;
      response = await fetch(directUrl);
    } catch (directError) {
      // CORS error or network error, fallback to proxy
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url + '&_cb=' + Date.now())}`;
      response = await fetch(proxyUrl);
    }
    
    if (!response || !response.ok) return null;
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    
    return {
      name: meta.shortName || meta.longName || code,
      price: meta.regularMarketPrice,
      basePrice: meta.chartPreviousClose || meta.regularMarketPrice,
      currency: 'USD'
    };
  } catch (e) {
    console.warn(`Failed to fetch US stock ${code}`, e);
    return null;
  }
};

export const lookupAssetDetails = async (code: string): Promise<{ name: string; price: number; basePrice?: number; currency?: 'CNY' | 'USD' } | null> => {
  if (!code) return null;
  
  // Normalize code: Tiantian API expects 6 digits (e.g., 518880). 
  // Strip common prefixes like sh/sz/of if user entered them.
  const normalizedCode = code.replace(/^(sh|sz|of)/i, '').trim();
  
  // 1. Try Tiantian Fund API (Best for CN Funds/ETFs)
  if (/^\d{6}$/.test(normalizedCode)) {
    try {
       const ttData = await fetchFromTiantian(normalizedCode);
       if (ttData && ttData.price > 0) {
         return { name: ttData.name, price: ttData.price, basePrice: (ttData as any).basePrice, currency: 'CNY' };
       }
    } catch (e) {
       console.warn("Tiantian fetch failed", e);
    }
  }

  // 2. Try US Stock via Yahoo Finance
  if (/^[A-Za-z\.\-]+$/.test(normalizedCode)) {
    try {
      const usStock = await fetchUSStock(normalizedCode.toUpperCase());
      if (usStock && usStock.price > 0) {
        return usStock;
      }
    } catch (e) {
      console.warn("US Stock fetch failed", e);
    }
  }

  // 3. Fallback to local mock DB
  const dbEntry = FALLBACK_DB[normalizedCode.toUpperCase()];
  if (dbEntry) {
    return { name: dbEntry.name, price: dbEntry.price, basePrice: dbEntry.price, currency: 'CNY' };
  }
  
  return null; 
};

export const fetchExchangeRate = async (): Promise<number> => {
  // 1. Try Tencent Finance for USD/CNY exchange rate
  try {
    const tencentRate = await new Promise<number | null>((resolve) => {
      const script = document.createElement('script');
      script.charset = 'gbk';
      const varName = 'v_whUSDCNY';
      
      script.src = `https://qt.gtimg.cn/q=whUSDCNY`;
      
      script.onload = () => {
        try {
          const data = (window as any)[varName];
          if (data && !data.includes('v_pv_none_match')) {
            const parts = data.split('~');
            if (parts.length > 3) {
              const rate = parseFloat(parts[3]);
              if (!isNaN(rate) && rate > 0) {
                resolve(rate);
                return;
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to parse Tencent Finance exchange rate`, e);
        } finally {
          if (script.parentNode) {
            document.body.removeChild(script);
          }
          delete (window as any)[varName];
        }
        resolve(null);
      };
      
      script.onerror = () => {
        if (script.parentNode) {
          document.body.removeChild(script);
        }
        resolve(null);
      };
      
      document.body.appendChild(script);
    });
    
    if (tencentRate) return tencentRate;
  } catch (e) {
    console.warn("Tencent Finance exchange rate fetch failed", e);
  }

  // 2. Fallback to Yahoo Finance
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/CNY=X?range=1d&interval=1d`;
    let response;
    
    try {
      const directUrl = `https://query2.finance.yahoo.com/v8/finance/chart/CNY=X?range=1d&interval=1d`;
      response = await fetch(directUrl);
    } catch (directError) {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url + '&_cb=' + Date.now())}`;
      response = await fetch(proxyUrl);
    }
    
    if (!response || !response.ok) return 7.2; // Fallback default
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return 7.2;
    
    const meta = result.meta;
    if (!meta || !meta.regularMarketPrice) return 7.2;
    
    return meta.regularMarketPrice;
  } catch (e) {
    console.warn(`Failed to fetch exchange rate`, e);
    return 7.2;
  }
};

export const fetchLatestPrices = async (assets: Asset[]): Promise<Record<string, { price: number; basePrice?: number }>> => {
  const newPrices: Record<string, { price: number; basePrice?: number }> = {};

  const cnAssets = assets.filter(a => a.code && /^\d{6}$/.test(a.code.replace(/^(sh|sz|of)/i, '').trim()));
  const usAssets = assets.filter(a => a.code && /^[A-Za-z\.\-]+$/.test(a.code.trim()));
  const otherAssets = assets.filter(a => a.code && !cnAssets.includes(a) && !usAssets.includes(a));

  // Fetch US assets in parallel (they use standard fetch with promises)
  const usPromises = usAssets.map(async (asset) => {
    try {
      const liveData = await lookupAssetDetails(asset.code);
      if (liveData && liveData.price > 0) {
        newPrices[asset.id] = { price: liveData.price, basePrice: liveData.basePrice };
      } else {
        newPrices[asset.id] = { price: asset.currentPrice, basePrice: asset.basePrice };
      }
    } catch (e) {
      newPrices[asset.id] = { price: asset.currentPrice, basePrice: asset.basePrice };
    }
  });

  // Process CN and other assets sequentially to respect the JSONP queue limitations
  for (const asset of [...cnAssets, ...otherAssets]) {
    // Small delay between requests to be polite to the API
    await new Promise(r => setTimeout(r, 100));

    try {
      const liveData = await lookupAssetDetails(asset.code);
      if (liveData && liveData.price > 0) {
        newPrices[asset.id] = { price: liveData.price, basePrice: liveData.basePrice };
      } else {
        newPrices[asset.id] = { price: asset.currentPrice, basePrice: asset.basePrice };
      }
    } catch (e) {
      newPrices[asset.id] = { price: asset.currentPrice, basePrice: asset.basePrice };
    }
  }

  // Wait for US fetches to complete
  await Promise.all(usPromises);

  return newPrices;
};