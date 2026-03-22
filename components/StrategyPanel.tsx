
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
        currentValue: portfolio.typeDetails[type]?.value || 0,
        profitAmount: portfolio.typeDetails[type]?.return || 0,
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
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
          策略收益
        </h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md font-medium">偏离阈值: +/- {strategy.maxDeviation}%</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {strategyAnalysis.map((item: any) => (
          <div key={item.type} className={`p-6 rounded-2xl border transition-all hover:shadow-lg relative overflow-hidden ${getStatusBg(item.status)}`}>
            {/* Background decoration */}
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 bg-current"></div>
            
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-xl tracking-tight">{item.displayName}</span>
                {item.status === 'red' && <AlertTriangle size={18} className="text-red-500" />}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(item.status)} border-current bg-white/80 shadow-sm`}>
                {item.action}
              </div>
            </div>
            
            {/* Highlighted Section: Net Asset Value, Profit/Loss, Return Rate */}
            <div className="mb-6 relative z-10">
              <div className="mb-4">
                <div className="text-xs text-gray-500 font-medium mb-1">资产净值</div>
                <div className="text-3xl font-black text-gray-900 tracking-tight font-mono">{fmtMoney(item.currentValue)}</div>
              </div>
              <div className="flex gap-6">
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">盈亏金额</div>
                  <div className={`text-lg font-bold font-mono ${item.profitAmount >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.profitAmount > 0 ? '+' : ''}{fmtMoney(item.profitAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">年度收益率</div>
                  <div className={`text-lg font-bold font-mono ${item.returnPercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {item.returnPercent > 0 ? '+' : ''}{item.returnPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            {/* De-emphasized Section: Target, Current, Adjustment */}
            <div className="pt-4 border-t border-gray-200/60 flex flex-col gap-2 relative z-10">
              <div className="flex justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  目标占比: <span className="font-mono">{item.target}%</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  当前占比: <span className="font-mono">{item.current.toFixed(1)}%</span>
                </span>
              </div>
              
              {Math.floor(Math.abs(item.diffValue) / 1000) * 1000 > 0 && (
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>调整建议</span>
                  <span className="font-mono">
                    {item.diffValue > 0 ? '减仓 ' : '补仓 '}
                    {fmtMoney(Math.floor(Math.abs(item.diffValue) / 1000) * 1000)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrategyPanel;
