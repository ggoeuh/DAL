// CalendarPage.jsx - 서버 연동 전용 리팩토링 전체 버전
import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  loadUserDataFromDAL,
  saveUserDataToDAL,
} from './utils/supabaseStorage.js';

const PASTEL_COLORS = [
  { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
  { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
  { bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
  { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-200" },
  { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-200" },
  { bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-200" },
  { bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-200" },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
];

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":" ).map(Number);
  return h * 60 + m;
};

const minutesToTimeString = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const CalendarPage = ({ currentUser, onLogout }) => {
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);

  const navigate = useNavigate();
  const currentDate = new Date();
  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) });

  useEffect(() => {
    const fetch = async () => {
      if (!currentUser) return;
      try {
        const data = await loadUserDataFromDAL(currentUser);
        setSchedules(data.schedules || []);
        setTags(data.tags || []);
        setTagItems(data.tagItems || []);
        setMonthlyGoals(data.monthlyGoals || []);
        console.log('✅ 서버 데이터 불러오기 성공');
      } catch (err) {
        console.error('❌ 서버 불러오기 실패', err);
      }
    };
    fetch();
  }, [currentUser]);

  useEffect(() => {
    const save = async () => {
      if (!currentUser) return;
      try {
        await saveUserDataToDAL(currentUser, {
          schedules,
          tags,
          tagItems,
          monthlyGoals,
        });
        console.log('💾 서버 저장 완료');
      } catch (err) {
        console.error('❌ 서버 저장 실패', err);
      }
    };
    save();
  }, [schedules, tags, tagItems, monthlyGoals]);

  const currentMonthSchedules = schedules.filter((s) => {
    const scheduleDate = new Date(s.date);
    return format(scheduleDate, 'yyyy-MM') === format(currentDate, 'yyyy-MM');
  });

  const calculateMonthlyTagTotals = () => {
    const totals = {};
    currentMonthSchedules.forEach((s) => {
      const tagItem = tagItems.find((t) => t.tagName === s.tag);
      const tagType = tagItem ? tagItem.tagType : s.tagType || '기타';
      if (!totals[tagType]) totals[tagType] = 0;
      const start = parseTimeToMinutes(s.start);
      const end = parseTimeToMinutes(s.end);
      totals[tagType] += end - start;
    });
    return totals;
  };

  const getTagColor = (tagType) => {
    const found = tags.find((t) => t.tagType === tagType);
    return found ? found.color : PASTEL_COLORS[0];
  };

  const getDayTotalHours = (date) => {
    const str = format(date, 'yyyy-MM-dd');
    const todaySchedules = schedules.filter((s) => s.date === str);
    const minutes = todaySchedules.reduce((sum, s) => {
      return sum + parseTimeToMinutes(s.end) - parseTimeToMinutes(s.start);
    }, 0);
    if (minutes === 0) return '';
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60 ? minutes % 60 + 'm' : ''}`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">{format(currentDate, 'yyyy년 M월')}</h1>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>👤 {currentUser}</span>
          <button onClick={onLogout} className="text-red-500 hover:underline">로그아웃</button>
        </div>
      </div>

      <div className="grid grid-cols-7 bg-gray-100 border-t border-b">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={i} className="text-center p-2 font-medium">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          const dateStr = format(day, 'yyyy-MM-dd');
          const daySchedules = schedules.filter((s) => s.date === dateStr);
          return (
            <div
              key={dateStr}
              className={`p-2 min-h-[100px] border text-sm relative cursor-pointer hover:bg-gray-50 ${isToday ? 'bg-blue-50' : ''}`}
              onClick={() => navigate(`/day/${dateStr}`)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold">{format(day, 'd')}</span>
                <span className="text-xs text-gray-500">{getDayTotalHours(day)}</span>
              </div>
              <div className="space-y-1">
                {daySchedules.map((s) => {
                  const tagItem = tagItems.find((ti) => ti.tagName === s.tag);
                  const tagType = tagItem ? tagItem.tagType : s.tagType || '기타';
                  const tagColor = getTagColor(tagType);
                  return (
                    <div
                      key={s.id}
                      className={`p-1 rounded border ${tagColor.bg} ${tagColor.border} ${tagColor.text}`}
                      title={`${s.start} ~ ${s.end} ${s.title}`}
                    >
                      <div className="truncate font-medium text-xs">
                        {s.start}-{s.end} {s.tag} | {s.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarPage;
