import React, { useState } from 'react';
import { TargetStrategy, AssetType } from '../types';
import { X, Save, AlertCircle } from 'lucide-react';

interface StrategyConfigProps {
  currentStrategy: TargetStrategy;
  onSave: (newStrategy: TargetStrategy) => void;
  onClose: () => void;
}

const StrategyConfig: React.FC<StrategyConfigProps> = ({ currentStrategy, onSave, onClose }) => {
  const [allocations, setAllocations] = useState({ ...currentStrategy.allocations });
  const [maxDeviation, setMaxDeviation] = useState(currentStrategy.maxDeviation);

  // Fix: Explicitly type accumulator to avoid 'unknown' type inference error
  const total = Object.values(allocations).reduce((sum: number, val) => sum + (val as number), 0);

  const handleAllocationChange = (type: AssetType, val: string) => {
    const num = parseFloat(val);
    setAllocations(prev => ({
      ...prev,
      [type]: isNaN(num) ? 0 : num
    }));
  };

  const handleSave = () => {
    onSave({
      allocations,
      maxDeviation
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">调整策略目标</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <AlertCircle size={18} />
            <span>当前总分配: <strong className={total !== 100 ? 'text-red-600' : ''}>{total}%</strong> (建议 100%)</span>
          </div>

          <div className="space-y-5">
            {Object.values(AssetType).map(type => (
              <div key={type}>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">{type}</label>
                  <span className="text-sm text-gray-500">{allocations[type]}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={allocations[type]}
                  onChange={e => handleAllocationChange(type, e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="mt-1">
                   <input 
                     type="number" 
                     className="w-full text-xs p-1 border rounded" 
                     value={allocations[type]} 
                     onChange={e => handleAllocationChange(type, e.target.value)}
                   />
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-gray-100">
               <label className="block text-sm font-medium text-gray-700 mb-2">偏离度阈值 (红灯触发)</label>
               <div className="flex items-center gap-3">
                 <input 
                   type="number" 
                   value={maxDeviation}
                   onChange={e => setMaxDeviation(parseFloat(e.target.value))}
                   className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                 />
                 <span className="text-gray-500">%</span>
               </div>
               <p className="text-xs text-gray-400 mt-1">当某项资产实际比例偏离目标超过此数值时，显示红色警告。</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={handleSave}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2"
          >
            <Save size={18} /> 保存策略
          </button>
        </div>
      </div>
    </div>
  );
};

export default StrategyConfig;