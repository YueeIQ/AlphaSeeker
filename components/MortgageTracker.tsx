import React, { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Home, Calculator, Trash2, Calendar, DollarSign, Percent, TrendingUp } from 'lucide-react';
import { Mortgage } from '../types';

interface MortgageTrackerProps {
  mortgages: Mortgage[];
  onUpdateMortgages: (mortgages: Mortgage[]) => void;
  onBack: () => void;
  totalAssetValue: number;
}

const MortgageTracker: React.FC<MortgageTrackerProps> = ({ mortgages, onUpdateMortgages, onBack, totalAssetValue }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMortgage, setEditingMortgage] = useState<Mortgage | null>(null);

  const getMortgageStateAtDate = (mortgage: Mortgage, targetDate: Date) => {
    const start = new Date(mortgage.startDate);
    let currentPrincipal = mortgage.initialPrincipal;
    let currentMonths = mortgage.remainingMonths;
    let monthsPassed = 0;

    let monthsToAdd = 0;
    let iterDate = new Date(start.getFullYear(), start.getMonth() + monthsToAdd, mortgage.repaymentDate);
    if (iterDate < start) {
      monthsToAdd++;
      iterDate = new Date(start.getFullYear(), start.getMonth() + monthsToAdd, mortgage.repaymentDate);
    }

    while (iterDate <= targetDate && currentMonths > 0) {
      const monthlyInterestRate = mortgage.interestRate / 100 / 12;
      const interestForMonth = currentPrincipal * monthlyInterestRate;
      const principalForMonth = mortgage.monthlyPayment - interestForMonth;
      
      currentPrincipal -= principalForMonth;
      currentMonths -= 1;
      monthsPassed += 1;
      
      monthsToAdd++;
      iterDate = new Date(start.getFullYear(), start.getMonth() + monthsToAdd, mortgage.repaymentDate);
    }

    const totalRemainingPayment = currentMonths * mortgage.monthlyPayment;

    return {
      currentPrincipal: Math.max(0, currentPrincipal),
      currentMonths: Math.max(0, currentMonths),
      totalRemainingPayment: Math.max(0, totalRemainingPayment),
      monthsPassed
    };
  };

  const calculateCurrentMortgage = (mortgage: Mortgage) => getMortgageStateAtDate(mortgage, new Date());

  const projections = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const endYear = 2042;
    const years = [];
    for (let y = currentYear; y <= endYear; y++) {
      years.push(y);
    }
    
    return years.map(year => {
      const juneDate = new Date(year, 5, 30); // June 30
      const decDate = new Date(year, 11, 31); // Dec 31
      
      const junePrincipal = mortgages.reduce((sum, m) => sum + getMortgageStateAtDate(m, juneDate).currentPrincipal, 0);
      const decPrincipal = mortgages.reduce((sum, m) => sum + getMortgageStateAtDate(m, decDate).currentPrincipal, 0);
      
      return { year, junePrincipal, decPrincipal };
    });
  }, [mortgages]);

  const fmtMoney = (n: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(n);

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这笔房贷记录吗？')) {
      onUpdateMortgages(mortgages.filter(m => m.id !== id));
    }
  };

  const totalCurrentPrincipal = useMemo(() => {
    return mortgages.reduce((sum, m) => sum + calculateCurrentMortgage(m).currentPrincipal, 0);
  }, [mortgages]);

  const totalRemainingPayment = useMemo(() => {
    return mortgages.reduce((sum, m) => sum + calculateCurrentMortgage(m).totalRemainingPayment, 0);
  }, [mortgages]);

  const totalMonthlyPayment = useMemo(() => {
    return mortgages.reduce((sum, m) => sum + m.monthlyPayment, 0);
  }, [mortgages]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-100 shadow-md">
              <Home className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">剩余房贷追踪</h1>
          </div>
          
          <button 
            onClick={() => { setEditingMortgage(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition"
          >
            <Plus size={16} /> <span className="hidden sm:inline">添加房贷</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Calculator size={80} />
            </div>
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500">当前剩余本金总额</p>
              <h2 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{fmtMoney(totalCurrentPrincipal)}</h2>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500">当前需还总额 (本金+利息)</p>
              <h2 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{fmtMoney(totalRemainingPayment)}</h2>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              包含未来所有利息支出
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500">每月总还款额</p>
              <h2 className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{fmtMoney(totalMonthlyPayment)}</h2>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500">净资产 (总资产 - 剩余房贷)</p>
              <h2 className={`text-2xl font-bold mt-1 tracking-tight ${totalAssetValue - totalCurrentPrincipal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {fmtMoney(totalAssetValue - totalCurrentPrincipal)}
              </h2>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              总资产: {fmtMoney(totalAssetValue)}
            </div>
          </div>
        </div>

        {/* Mortgage List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">房贷明细</h2>
          {mortgages.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <Home className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">暂无房贷记录</h3>
              <p className="mt-1 text-sm text-gray-500">点击右上角添加您的第一笔房贷记录，开始追踪还款进度。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mortgages.map(mortgage => {
                const current = calculateCurrentMortgage(mortgage);
                return (
                  <div key={mortgage.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition relative group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{mortgage.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">录入日期: {new Date(mortgage.startDate).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setEditingMortgage(mortgage); setShowAddModal(true); }}
                          className="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded text-xs font-medium transition"
                        >
                          编辑
                        </button>
                        <button 
                          onClick={() => handleDelete(mortgage.id)}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><DollarSign size={12}/> 当前剩余本金</p>
                        <p className="font-bold text-gray-900">{fmtMoney(current.currentPrincipal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calculator size={12}/> 当前需还总额</p>
                        <p className="font-bold text-gray-900">{fmtMoney(current.totalRemainingPayment)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Percent size={12}/> 房贷利率</p>
                        <p className="font-medium text-gray-900">{mortgage.interestRate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar size={12}/> 每月还款</p>
                        <p className="font-medium text-gray-900">{fmtMoney(mortgage.monthlyPayment)} (每月{mortgage.repaymentDate}日)</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>还款进度 (剩余 {current.currentMonths} 个月)</span>
                        <span>已还 {current.monthsPassed} 个月</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-1.5 rounded-full" 
                          style={{ width: `${(current.monthsPassed / mortgage.remainingMonths) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Projection Module */}
        {mortgages.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-600" />
              房贷余额预估 (至2042年)
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3 font-semibold">年份</th>
                      <th className="px-6 py-3 text-right font-semibold">6月底剩余本金</th>
                      <th className="px-6 py-3 text-right font-semibold">12月底剩余本金</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projections.map(p => (
                      <tr key={p.year} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 font-medium text-gray-900">{p.year}年</td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">{p.junePrincipal > 0 ? fmtMoney(p.junePrincipal) : '-'}</td>
                        <td className="px-6 py-4 text-right font-mono text-gray-600">{p.decPrincipal > 0 ? fmtMoney(p.decPrincipal) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {showAddModal && (
        <MortgageEntryModal 
          mortgage={editingMortgage}
          onSave={(newMortgage) => {
            if (editingMortgage) {
              onUpdateMortgages(mortgages.map(m => m.id === newMortgage.id ? newMortgage : m));
            } else {
              onUpdateMortgages([...mortgages, newMortgage]);
            }
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

interface MortgageEntryModalProps {
  mortgage: Mortgage | null;
  onSave: (mortgage: Mortgage) => void;
  onClose: () => void;
}

const MortgageEntryModal: React.FC<MortgageEntryModalProps> = ({ mortgage, onSave, onClose }) => {
  const [name, setName] = useState(mortgage?.name || '首套房贷');
  const [initialPrincipal, setInitialPrincipal] = useState(mortgage?.initialPrincipal.toString() || '');
  const [interestRate, setInterestRate] = useState(mortgage?.interestRate.toString() || '');
  const [remainingMonths, setRemainingMonths] = useState(mortgage?.remainingMonths.toString() || '');
  const [monthlyPayment, setMonthlyPayment] = useState(mortgage?.monthlyPayment.toString() || '');
  const [repaymentDate, setRepaymentDate] = useState(mortgage?.repaymentDate.toString() || '15');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newMortgage: Mortgage = {
      id: mortgage?.id || Date.now().toString(),
      name,
      initialPrincipal: parseFloat(initialPrincipal),
      interestRate: parseFloat(interestRate),
      remainingMonths: parseInt(remainingMonths, 10),
      monthlyPayment: parseFloat(monthlyPayment),
      repaymentDate: parseInt(repaymentDate, 10),
      startDate: mortgage?.startDate || new Date().toISOString(),
    };

    onSave(newMortgage);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900">{mortgage ? '编辑房贷' : '添加房贷'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">房贷名称</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="例如：首套房贷"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">剩余房贷金额 (元)</label>
              <input 
                type="number" 
                required
                min="0"
                step="0.01"
                value={initialPrincipal}
                onChange={e => setInitialPrincipal(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="例如：1000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">房贷利率 (%)</label>
              <input 
                type="number" 
                required
                min="0"
                step="0.01"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="例如：4.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">剩余还款月份数</label>
              <input 
                type="number" 
                required
                min="1"
                step="1"
                value={remainingMonths}
                onChange={e => setRemainingMonths(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="例如：360"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">每月还款日期 (日)</label>
              <input 
                type="number" 
                required
                min="1"
                max="31"
                step="1"
                value={repaymentDate}
                onChange={e => setRepaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="例如：15"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当前每月还款金额 (元)</label>
            <input 
              type="number" 
              required
              min="0"
              step="0.01"
              value={monthlyPayment}
              onChange={e => setMonthlyPayment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              placeholder="例如：5000"
            />
            <p className="text-xs text-gray-500 mt-1">包含本金和利息的总还款额</p>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              取消
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition shadow-sm hover:shadow"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MortgageTracker;
