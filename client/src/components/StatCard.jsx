import React from 'react';

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-md flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
    <Icon className={`w-8 h-8 ${color} opacity-70`} />
  </div>
);

export default StatCard;
