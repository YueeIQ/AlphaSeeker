
import React, { useMemo } from 'react';
import { AssetType, PortfolioSummary, TargetStrategy, TrafficLightStatus } from '../types';
import { Asset } from '../types';
import { AlertTriangle } from 'lucide-react';

interface StrategyPanelProps {
  portfolio: PortfolioSummary;
  assets: Asset[];
  strategy: TargetStrategy;
}

const StrategyPanel: React.FC<StrategyPanelProps> = ({ portfolio, assets, strategy }) => {
  // Calculate Traffic Light status for each category
  const strategyAnalysis = useMemo(() => {
    return Object.values(AssetType).map(type => {
      // Include Cash in analysis now
      const currentAlloc = portfolio.allocation[type] || 0;
      const targetAlloc = strategy.allocations[type] || 0;
      
      if (targetAlloc === 0) return null;

      // Calculate Drift
      const drift = currentAlloc - targetAlloc;
      // Prevent division by zero
      const relativeDrift = targetAlloc > 0 ? (Math.abs(drift) / targetAlloc) * 100 : (currentAlloc > 0 ? 100 : 0);
      
      let status: TrafficLightStatus = 'green';
      let action = '持有';

      if (relativeDrift > strategy.maxDeviation) {
        status = 'red';
        action = drift > 0 ? '止盈 / 卖出' : '补仓 / 买入';
      } else if (relativeDrift > strategy.maxDeviation / 2) {
        status = 'yellow';
        action = drift > 0 ? '关注超配' : '考虑买入';
      }

      const targetValue = portfolio.totalValue * (targetAlloc / 100);
      const currentValue = portfolio.totalValue * (currentAlloc / 100);
      const diffValue = currentValue - targetValue;

      return {
        type,
        displayName: strategy.customNames?.[type] || type,
        current: currentAlloc,
        target: targetAlloc,
        drift,
        status,
        action,
        diffValue,
        returnPercent: portfolio.typeDetails[type]?.returnPercent || 0
      };
    }).filter(Boolean);
  }, [portfolio, strategy]);

  const getStatusColor = (status: TrafficLightStatus) => {
    switch (status) {
      case 'red': return 'text-red-600';
      case 'yellow': return 'text-yellow-600';
      case 'green': return 'text-green-600';
    }
  };

  const getStatusBg = (status: TrafficLightStatus) => {
    switch (status) {
      case 'red': return 'bg-red-50 border-red-100';
      case 'yellow': return 'bg-yellow-50 border-yellow-100';
      case 'green': return 'bg-green-50 border-green-100';
    }
  };

  const fmtMoney = (n: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
          策略偏离红绿灯
        </h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md font-medium">阈值: +/- {strategy.maxDeviation}%</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategyAnalysis.map((item: any) => (
          <div key={item.type} className={`p-5 rounded-2xl border transition-all hover:shadow-md ${getStatusBg(item.status)}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 text-lg">{item.displayName}</span>
                {item.status === 'red' && <AlertTriangle size={16} className="text-red-500" />}
              </div>
              <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(item.status)} border-current bg-white/50`}>
                {item.action}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-4 bg-white/60 p-3 rounded-xl">
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">目标占比</div>
                <div className="text-sm font-black text-gray-900 font-mono">{item.target}%</div>
              </div>
              <div className="text-center border-x border-gray-200/50">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">当前占比</div>
                <div className="text-sm font-black text-gray-900 font-mono">{item.current.toFixed(1)}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">年度收益</div>
                <div className={`text-sm font-black font-mono ${item.returnPercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {item.returnPercent > 0 ? '+' : ''}{item.returnPercent.toFixed(2)}%
                </div>
              </div>
            </div>

            {Math.floor(Math.abs(item.diffValue) / 1000) * 1000 > 0 && (
              <div className="pt-3 border-t border-gray-200/50 text-xs font-medium text-gray-600 flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.diffValue > 0 ? 'bg-orange-500' : 'bg-indigo-500'}`}></div>
                  调整建议
                </span>
                <span className={`font-bold font-mono text-sm ${item.diffValue > 0 ? 'text-orange-600' : 'text-indigo-600'}`}>
                  {item.diffValue > 0 ? '需减仓 ' : '需补仓 '}
                  {fmtMoney(Math.floor(Math.abs(item.diffValue) / 1000) * 1000)}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrategyPanel;
