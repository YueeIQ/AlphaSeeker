
import React, { useMemo, useState } from 'react';
import { AssetType, PortfolioSummary, TargetStrategy, TrafficLightStatus } from '../types';
import { generateStrategyReport } from '../services/gemini';
import { Asset } from '../types';
import { AlertTriangle, CheckCircle, RefreshCw, BrainCircuit, Loader2 } from 'lucide-react';

interface StrategyPanelProps {
  portfolio: PortfolioSummary;
  assets: Asset[];
  strategy: TargetStrategy;
}

// Simple Markdown Renderer Component
const MarkdownRenderer = ({ content }: { content: string }) => {
  if (!content) return null;
  
  const lines = content.split('\n');
  return (
    <div className="space-y-3 font-medium text-gray-700">
      {lines.map((line, index) => {
        // Headers
        if (line.trim().startsWith('##')) {
           return <h4 key={index} className="text-lg font-bold text-indigo-900 mt-4 mb-2 pb-1 border-b border-indigo-100">{line.replace(/^#+\s*/, '')}</h4>;
        }
        if (line.trim().startsWith('#')) {
           return <h3 key={index} className="text-xl font-bold text-gray-900 mt-6 mb-3">{line.replace(/^#+\s*/, '')}</h3>;
        }
        
        // List items
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
           const cleanLine = line.replace(/^[-*]\s*/, '');
           // Handle Bold inside list
           const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
           return (
             <div key={index} className="flex items-start gap-2 ml-1">
               <span className="text-indigo-400 mt-1.5">•</span>
               <p className="flex-1 leading-relaxed">
                 {parts.map((part, i) => 
                   part.startsWith('**') && part.endsWith('**') 
                     ? <strong key={i} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong> 
                     : part
                 )}
               </p>
             </div>
           );
        }
        
        // Numbered lists
        if (/^\d+\./.test(line.trim())) {
           const parts = line.split(/(\*\*.*?\*\*)/g);
           return (
             <p key={index} className="ml-1 leading-relaxed">
               {parts.map((part, i) => 
                   part.startsWith('**') && part.endsWith('**') 
                     ? <strong key={i} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong> 
                     : part
                 )}
             </p>
           );
        }

        // Empty lines
        if (!line.trim()) return <div key={index} className="h-2"></div>;

        // Regular paragraphs with bold support
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={index} className="leading-relaxed">
            {parts.map((part, i) => 
              part.startsWith('**') && part.endsWith('**') 
                ? <strong key={i} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong> 
                : part
            )}
          </p>
        );
      })}
    </div>
  );
};

const StrategyPanel: React.FC<StrategyPanelProps> = ({ portfolio, assets, strategy }) => {
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

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

      return {
        type,
        current: currentAlloc,
        target: targetAlloc,
        drift,
        status,
        action
      };
    }).filter(Boolean);
  }, [portfolio, strategy]);

  const handleAskAI = async () => {
    setIsLoadingAi(true);
    const report = await generateStrategyReport(portfolio, assets, strategy);
    setAiReport(report);
    setIsLoadingAi(false);
  };

  const getStatusColor = (status: TrafficLightStatus) => {
    switch (status) {
      case 'red': return 'bg-red-100 text-red-700 border-red-200';
      case 'yellow': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'green': return 'bg-green-100 text-green-700 border-green-200';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Traffic Light System */}
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
            <div key={item.type} className="flex items-center justify-between p-3 rounded-lg border border-gray-50 hover:bg-gray-50 transition">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">{item.type}</span>
                  {item.status === 'red' && <AlertTriangle size={14} className="text-red-500" />}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  目标: {item.target}% <span className="mx-1">|</span> 当前: {item.current.toFixed(1)}%
                </div>
              </div>
              
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>
                {item.action}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Advisor Panel */}
      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
            <BrainCircuit size={20} />
            智能投顾建议 (Smart Advisor)
          </h3>
          <button 
            onClick={handleAskAI}
            disabled={isLoadingAi}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1"
          >
            {isLoadingAi ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            生成分析报告
          </button>
        </div>

        <div className="flex-1 bg-white rounded-lg p-5 text-sm overflow-y-auto max-h-[300px] shadow-inner">
          {aiReport ? (
            <MarkdownRenderer content={aiReport} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
              <BrainCircuit size={48} className="mb-2 opacity-20" />
              <p>点击“生成分析报告”<br/>获取基于当前行情的AI策略复盘。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategyPanel;
