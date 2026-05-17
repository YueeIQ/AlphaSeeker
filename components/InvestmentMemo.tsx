import React, { useState } from 'react';
import { Shield, Target, TrendingUp, Activity, Wallet, Edit2, Check } from 'lucide-react';
import { Discipline } from '../types';

interface InvestmentMemoProps {
  disciplines: Discipline[];
  recentFocus: string;
  onUpdateDisciplines: (newDisciplines: Discipline[]) => void;
  onUpdateRecentFocus: (newFocus: string) => void;
}

const ICONS = [Target, TrendingUp, Activity, Wallet];

const InvestmentMemo: React.FC<InvestmentMemoProps> = ({ disciplines, recentFocus, onUpdateDisciplines, onUpdateRecentFocus }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editContent, setEditContent] = useState('');

  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [editFocusText, setEditFocusText] = useState(recentFocus);

  const handleEditClick = (d: Discipline) => {
    setEditingId(d.id);
    setEditTitle(d.title);
    setEditLabel(d.label);
    setEditContent(d.content);
  };

  const handleSave = () => {
    onUpdateDisciplines(disciplines.map(d => 
      d.id === editingId ? { ...d, title: editTitle, label: editLabel, content: editContent } : d
    ));
    setEditingId(null);
  };

  const handleSaveFocus = () => {
    onUpdateRecentFocus(editFocusText);
    setIsEditingFocus(false);
  };

  return (
    <div className="space-y-4">
      {/* 投资纪律模块 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-xl overflow-hidden border border-indigo-900/50">
        <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-lg">
            <Shield className="text-indigo-400" size={20} />
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">AlphaSeeker 投资纪律</h2>
          <div className="ml-auto text-xs font-medium text-indigo-300/60 uppercase tracking-widest">Investment Memo</div>
        </div>
        
        <div className="px-6 py-4 bg-white/5 border-b border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {disciplines.map((d, i) => {
            const styles = [
               "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
               "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
               "bg-amber-500/20 text-amber-300 border-amber-500/30",
               "bg-blue-500/20 text-blue-300 border-blue-500/30",
            ];
            const cls = styles[i % styles.length];
            return (
              <div key={`label-${d.id}`} className="flex justify-center">
                <span className={`w-full max-w-[140px] py-1.5 text-center rounded-full ${cls} text-sm font-bold tracking-widest border shadow-sm`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
          {disciplines.map((d, i) => {
            const Icon = ICONS[i % ICONS.length];
            const colors = ['text-indigo-400', 'text-emerald-400', 'text-amber-400', 'text-blue-400'];
            const color = colors[i % colors.length];

            return (
              <div key={d.id} className="p-6 flex flex-col gap-3 hover:bg-white/5 transition-colors relative group">
                {editingId === d.id ? (
                  <div className="flex flex-col gap-2 relative z-10 w-full animate-in fade-in">
                    <input 
                      type="text" 
                      value={editLabel} 
                      onChange={e => setEditLabel(e.target.value)} 
                      className="bg-white/10 border border-white/20 text-white rounded px-2 py-1 text-xs" 
                      placeholder="标签 (如: 择时)"
                    />
                    <input 
                      type="text" 
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)} 
                      className="bg-white/10 border border-white/20 text-white rounded px-2 py-1 text-sm font-bold" 
                      placeholder="标题"
                    />
                    <textarea 
                      value={editContent} 
                      onChange={e => setEditContent(e.target.value)} 
                      className="bg-white/10 border border-white/20 text-white rounded px-2 py-1 flex-1 text-sm min-h-[100px] resize-none"
                      placeholder="内容"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                       <button onClick={() => setEditingId(null)} className="text-white/60 hover:text-white text-xs px-2 py-1">取消</button>
                       <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded flex items-center gap-1"><Check size={12}/> 保存</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => handleEditClick(d)}
                      className="absolute top-4 right-4 p-1.5 opacity-0 group-hover:opacity-100 transition text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded"
                    >
                      <Edit2 size={14} />
                    </button>
                    <div className={`flex items-center gap-2 ${color}`}>
                      <Icon size={18} />
                      <span className="font-bold text-sm tracking-wider">{d.title}</span>
                    </div>
                    <p className="text-sm text-indigo-100/80 leading-relaxed whitespace-pre-wrap">{d.content}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 近期投资重点模块 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
         <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 hover:bg-gray-50 transition cursor-pointer" onClick={() => { if(!isEditingFocus) setIsEditingFocus(true); }}>
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              近期投资重点
            </h3>
            {!isEditingFocus && (
               <div className="text-gray-400 opacity-0 group-hover:opacity-100 transition text-xs flex items-center gap-1">
                  <Edit2 size={12} /> 点击编辑
               </div>
            )}
         </div>
         <div className="p-6">
            {isEditingFocus ? (
              <div className="flex flex-col gap-3 animate-in fade-in">
                <textarea 
                  value={editFocusText}
                  onChange={(e) => setEditFocusText(e.target.value)}
                  className="w-full min-h-[120px] p-4 bg-gray-50 border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-none text-gray-700 text-sm leading-relaxed transition resize-y"
                  placeholder="记录下近期的投资思路、关注的标的或操作计划..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                   <button 
                     onClick={() => { setEditFocusText(recentFocus); setIsEditingFocus(false); }}
                     className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition"
                   >
                     取消
                   </button>
                   <button 
                     onClick={handleSaveFocus}
                     className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition shadow-sm hover:shadow flex items-center gap-1.5"
                   >
                     <Check size={16} /> 保存重点
                   </button>
                </div>
              </div>
            ) : (
              <div 
                className="prose prose-sm max-w-none text-gray-600 leading-relaxed min-h-[60px] whitespace-pre-wrap cursor-text"
                onClick={() => setIsEditingFocus(true)}
              >
                {recentFocus || <span className="text-gray-400 italic">暂无近期投资重点，点击添加记录。</span>}
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default InvestmentMemo;
