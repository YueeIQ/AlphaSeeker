
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PortfolioSummary, AssetType } from '../types';
import { ASSET_COLORS } from '../constants';

interface PortfolioChartProps {
  summary: PortfolioSummary;
}

const PortfolioChart: React.FC<PortfolioChartProps> = ({ summary }) => {
  const data = Object.entries(summary.allocation).map(([key, value]) => ({
    name: key,
    value: parseFloat((value as number).toFixed(1)),
  })).filter(item => item.value > 0);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={ASSET_COLORS[entry.name as AssetType] || '#ccc'} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `${value}%`}
            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="text-xs text-gray-600 ml-1">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PortfolioChart;
