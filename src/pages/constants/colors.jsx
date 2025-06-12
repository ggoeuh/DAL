import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';


export const PASTEL_COLORS = [
  { bg: "bg-purple-100", text: "text-purple-800" },
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-green-100", text: "text-green-800" },
  { bg: "bg-yellow-100", text: "text-yellow-800" },
  { bg: "bg-red-100", text: "text-red-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-cyan-100", text: "text-cyan-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
];


const tags = [
  { name: '공부', color: 'bg-blue-500' },
  { name: '운동', color: 'bg-green-500' },
  { name: '휴식', color: 'bg-yellow-500' },
];

const mockMonthlyData = {
  공부: 32,
  운동: 10,
  휴식: 20,
};

const CalendarPage = () => {
  const currentDate = new Date();
  const navigate = useNavigate();
  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{format(currentDate, 'yyyy년 M월')}</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {tags.map((tag) => (
          <div key={tag.name} className="flex items-center p-4 border rounded shadow-sm">
            <div className={`w-4 h-4 mr-2 rounded-full ${tag.color}`}></div>
            <div className="text-lg font-medium">{tag.name}: {mockMonthlyData[tag.name] || 0}시간</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div
            key={day}
            className="cursor-pointer p-2 border rounded text-center hover:bg-gray-100"
            onClick={() => navigate(`/day/${format(day, 'yyyy-MM-dd')}`)}
          >
            {format(day, 'd')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarPage;
