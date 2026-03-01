
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
        current: currentAlloc,
        target: targetAlloc,
        drift,
        status,
        action,
        diffValue
      };
    }).filter(Boolean);
  }, [portfolio, strategy]);

  const getStatusColor = (status: TrafficLightStatus) => {
    switch (status) {
      case 'red': return 'bg-red-100 text-red-700 border-red-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'green': return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  const fmtMoney = (n: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
          策略偏离红绿灯
        </h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">阈值: +/- {strategy.maxDeviation}%</span>
      </div>

      <div className="space-y-4">
        {strategyAnalysis.map((item: any) => (
          <div key={item.type} className="flex items-center justify-between p-4 rounded-lg border border-gray-50 hover:bg-gray-50 transition">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">{item.type}</span>
                {item.status === 'red' && <AlertTriangle size={14} className="text-red-500" />}
              </div>
              <div className="text-sm text-gray-500 mt-1 flex gap-4">
                <span>目标: {item.target}%</span>
                <span>当前: {item.current.toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                {Math.abs(item.diffValue) > 0.01 && (
                  <div className="text-sm font-medium text-gray-700">
                    {item.diffValue > 0 ? '需减仓 ' : '需补仓 '}
                    <span className="font-bold">{fmtMoney(Math.abs(item.diffValue))}</span>
                  </div>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>
                {item.action}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrategyPanel;
