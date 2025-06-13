// pages/DetailedCalendar.jsx - 멤버별 상세 캘린더 컴포넌트 (AdminMemberView에서 사용) - 완전 버전
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 파스텔 색상 팔레트
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

// 날짜 유틸리티 함수들
const formatDate = (date, format) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  switch (format) {
    case 'yyyy-MM-dd':
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    case 'yyyy년 M월':
      return `${year}년 ${month}월`;
    case 'yyyy년 M월 d일':
      return `${year}년 ${month}월 ${day}일`;
    case 'd':
      return day.toString();
    case 'M':
      return month.toString();
    default:
      return date.toString();
  }
};

const getMonthDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // 월의 첫째 날과 마지막 날
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // 캘린더 시작일 (일요일부터 시작)
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  // 캘린더 마지막일 (토요일까지)
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
  
  const days = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};

// 시간 관련 함수들
const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTimeString = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

// 일정 상세보기 모달 컴포넌트
const ScheduleDetailModal = ({ isOpen, onClose, schedule, tagColor }) => {
  if (!isOpen || !schedule) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold">📅 일정 상세보기</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">태그</label>
            <div className={`inline-block px-3 py-1 rounded-full text-sm ${tagColor.bg} ${tagColor.text} ${tagColor.border} border`}>
              {schedule.tag} | {schedule.tagType}
            </div>
          </div>
          
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">제목</label>
            <div className="text-lg font-semibold text-gray-800">{schedule.title}</div>
          </div>
          
          {/* 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">시작 시간</label>
              <div className="text-gray-800 font-medium">{schedule.start}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">종료 시간</label>
              <div className="text-gray-800 font-medium">{schedule.end}</div>
            </div>
          </div>
          
          {/* 소요 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">소요 시간</label>
            <div className="text-gray-800 font-medium">
              {(() => {
                const startMinutes = parseTimeToMinutes(schedule.start);
                const endMinutes = parseTimeToMinutes(schedule.end);
                const duration = endMinutes - startMinutes;
                return minutesToTimeString(duration);
              })()}
            </div>
          </div>
          
          {/* 설명 */}
          {schedule.description && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">설명</label>
              <div className="text-gray-800 bg-gray-50 p-3 rounded-lg">
                {schedule.description}
              </div>
            </div>
          )}
          
          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">날짜</label>
            <div className="text-gray-800 font-medium">{schedule.date}</div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// 메인 DetailedCalendar 컴포넌트 (멤버별 데이터를 props로 받음)
const DetailedCalendar = ({ 
  schedules = [], 
  tags = [], 
  tagItems = [], 
  monthlyGoals = [],
  currentUser = 'demo-user',
  isAdminView = false,
  onLogout = () => {},
  onBackToDashboard = null
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [dataStats, setDataStats] = useState({
    totalSchedules: 0,
    currentMonthSchedules: 0,
    tagTypes: 0,
    totalTime: '00:00'
  });
  const navigate = useNavigate();

  // ✨ 데이터 안전성 검증 및 로깅
  useEffect(() => {
    console.log('📊 DetailedCalendar 데이터 확인:', {
      currentUser,
      isAdminView,
      schedules: schedules?.length || 0,
      tags: tags?.length || 0,
      tagItems: tagItems?.length || 0,
      monthlyGoals: monthlyGoals?.length || 0
    });

    // 데이터 통계 계산
    const currentMonth = formatDate(currentDate, 'yyyy-MM').substring(0, 7);
    const currentMonthSchedules = safeSchedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleMonth = formatDate(scheduleDate, 'yyyy-MM').substring(0, 7);
      return scheduleMonth === currentMonth;
    });

    // 총 활동 시간 계산
    const totalMinutes = currentMonthSchedules.reduce((sum, schedule) => {
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      return sum + (endMinutes - startMinutes);
    }, 0);

    // 사용된 태그 타입 수 계산
    const usedTagTypes = new Set(currentMonthSchedules.map(schedule => {
      const tagItem = safeTagItems.find(item => item.tagName === schedule.tag);
      return tagItem ? tagItem.tagType : (schedule.tagType || "기타");
    }));

    setDataStats({
      totalSchedules: safeSchedules.length,
      currentMonthSchedules: currentMonthSchedules.length,
      tagTypes: usedTagTypes.size,
      totalTime: minutesToTimeString(totalMinutes)
    });

  }, [schedules, tags, tagItems, monthlyGoals, currentDate, currentUser]);

  // 안전한 배열 보장
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];
  const safeMonthlyGoals = Array.isArray(monthlyGoals) ? monthlyGoals : [];

  // ✨ 데이터 없음 상태 처리
  if (safeSchedules.length === 0 && safeTags.length === 0 && safeTagItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* 관리자 네비게이션 바 */}
        {isAdminView && (
          <nav className="bg-red-600 text-white p-4 shadow-lg">
            <div className="container mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-4">
                {onBackToDashboard && (
                  <button 
                    onClick={onBackToDashboard}
                    className="hover:bg-red-700 px-3 py-1.5 rounded transition duration-200 flex items-center"
                  >
                    <span className="mr-2">←</span>
                    대시보드로
                  </button>
                )}
                <div className="border-l border-red-400 pl-4">
                  <h1 className="text-xl font-bold">
                    👑 {currentUser}님의 상세 캘린더
                  </h1>
                  <p className="text-red-200 text-sm">관리자 모드</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-red-200 text-sm">
                  {new Date().toLocaleDateString('ko-KR')}
                </span>
                {onLogout && (
                  <button 
                    onClick={onLogout}
                    className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded transition duration-200"
                  >
                    로그아웃
                  </button>
                )}
              </div>
            </div>
          </nav>
        )}

        {/* 데이터 없음 메시지 */}
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white rounded-lg shadow-lg p-12 text-center max-w-md">
            <div className="text-gray-400 text-6xl mb-6">📅</div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-3">
              데이터가 없습니다
            </h3>
            <p className="text-gray-500 mb-6">
              <strong>{currentUser}님</strong>의 캘린더 데이터를 찾을 수 없습니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
              <h4 className="font-semibold mb-2">💡 확인 사항</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 해당 멤버가 로그인한 적이 있는지 확인</li>
                <li>• 일정을 등록한 적이 있는지 확인</li>
                <li>• 브라우저 데이터가 삭제되지 않았는지 확인</li>
              </ul>
            </div>
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                관리자 대시보드로 돌아가기
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 현재 월의 날짜들
  const days = getMonthDays(currentDate);
  
  // 현재 월의 일정들만 필터링
  const currentMonthSchedules = safeSchedules.filter(schedule => {
    const scheduleDate = new Date(schedule.date);
    const currentMonth = formatDate(currentDate, 'yyyy-MM').substring(0, 7); // yyyy-MM
    const scheduleMonth = formatDate(scheduleDate, 'yyyy-MM').substring(0, 7);
    return scheduleMonth === currentMonth;
  });

  // 태그별 총 시간 계산 (실제 사용 시간) - CalendarPage와 동일한 로직
  const calculateMonthlyTagTotals = () => {
    const totals = {};
    
    currentMonthSchedules.forEach(schedule => {
      // 태그 항목에서 tagType 찾기
      const tagItem = safeTagItems.find(item => item.tagName === schedule.tag);
      const tagType = tagItem ? tagItem.tagType : (schedule.tagType || "기타");
      
      if (!totals[tagType]) {
        totals[tagType] = 0;
      }
      
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const duration = endMinutes - startMinutes;
      
      totals[tagType] += duration;
    });
    
    return totals; // 분 단위로 반환
  };

  // 월간 목표 불러오기 - CalendarPage와 동일한 로직
  const getCurrentMonthGoals = () => {
    const currentMonthKey = formatDate(currentDate, 'yyyy-MM').substring(0, 7);
    const found = safeMonthlyGoals.find(goal => goal.month === currentMonthKey);
    return found?.goals || [];
  };

  // 퍼센테이지 계산
  const calculatePercentage = (actual, goal) => {
    if (goal === 0) return 0;
    return Math.round((actual / goal) * 100);
  };

  // 태그 색상 가져오기
  const getTagColor = (tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : PASTEL_COLORS[0];
  };

  // 특정 날짜의 일정들 가져오기
  const getSchedulesForDate = (date) => {
    const dateString = formatDate(date, 'yyyy-MM-dd');
    return safeSchedules.filter(schedule => schedule.date === dateString)
      .sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
  };

  // 일정 클릭 핸들러 (상세보기)
  const handleScheduleClick = (schedule, e) => {
    e.stopPropagation();
    console.log('📅 일정 클릭:', schedule);
    setSelectedSchedule(schedule);
    setIsDetailModalOpen(true);
  };

  // 이전/다음 달로 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthlyTagTotals = calculateMonthlyTagTotals();
  const currentMonthGoalsData = getCurrentMonthGoals();
  
  // 목표가 있거나 이번 달에 실제 사용된 태그타입만 표시 - CalendarPage와 동일한 로직
  const goalTagTypes = currentMonthGoalsData.map(goal => goal.tagType);
  const currentMonthUsedTagTypes = [...new Set(currentMonthSchedules.map(schedule => {
    const tagItem = safeTagItems.find(item => item.tagName === schedule.tag);
    return tagItem ? tagItem.tagType : (schedule.tagType || "기타");
  }))];
  
  const allTagTypes = [...new Set([...goalTagTypes, ...currentMonthUsedTagTypes])];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 관리자 네비게이션 바 (isAdminView일 때만) */}
      {isAdminView && (
        <nav className="bg-red-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {onBackToDashboard && (
                <button 
                  onClick={onBackToDashboard}
                  className="hover:bg-red-700 px-3 py-1.5 rounded transition duration-200 flex items-center"
                >
                  <span className="mr-2">←</span>
                  대시보드로
                </button>
              )}
              <div className="border-l border-red-400 pl-4">
                <h1 className="text-xl font-bold">
                  👑 {currentUser}님의 상세 캘린더 (읽기 전용)
                </h1>
                <p className="text-red-200 text-sm">관리자 모드</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-red-200 text-sm">
                {new Date().toLocaleDateString('ko-KR')}
              </span>
              {onLogout && (
                <button 
                  onClick={onLogout}
                  className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded transition duration-200"
                >
                  로그아웃
                </button>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* 관리자 모드 알림 배너 */}
      {isAdminView && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-400 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">관리자 모드 (읽기 전용)</h3>
              <div className="mt-1 text-sm text-red-700">
                <p>
                  <strong>{currentUser}님</strong>의 상세한 일정 정보를 읽기 전용으로 조회하고 있습니다. 
                  <strong> 일정을 클릭하면 상세 정보를 확인할 수 있습니다.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-200 rounded-lg text-xl transition-colors"
            >
              ←
            </button>
            <h2 className="text-3xl font-bold text-gray-800">
              {formatDate(currentDate, 'yyyy년 M월')}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-200 rounded-lg text-xl transition-colors"
            >
              →
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 text-right">
              <div>{isAdminView ? `조회 대상: ${currentUser}` : `사용자: ${currentUser}`}</div>
              <div className="text-xs text-gray-500">
                이번 달: {dataStats.currentMonthSchedules}개 일정 | 총 {dataStats.totalTime}
              </div>
            </div>
            <button
              onClick={goToToday}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              오늘
            </button>
          </div>
        </div>

        {/* ✨ 데이터 요약 카드 추가 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm">📅</span>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">총 일정</div>
                <div className="text-2xl font-bold text-gray-900">{dataStats.totalSchedules}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">📊</span>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">이번 달</div>
                <div className="text-2xl font-bold text-gray-900">{dataStats.currentMonthSchedules}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 text-sm">🏷️</span>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">활동 유형</div>
                <div className="text-2xl font-bold text-gray-900">{dataStats.tagTypes}</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 text-sm">⏰</span>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-500">활동 시간</div>
                <div className="text-2xl font-bold text-gray-900">{dataStats.totalTime}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 캘린더 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 bg-gray-100 border-b">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
              <div key={day} className={`p-3 text-center font-medium ${
                index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
              }`}>
                {day}
              </div>
            ))}
          </div>
          
          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const isCurrentMonth = formatDate(day, 'M') === formatDate(currentDate, 'M');
              const isToday = formatDate(day, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');
              const daySchedules = getSchedulesForDate(day);
              const isWeekend = index % 7 === 0 || index % 7 === 6;
              
              return (
                <div
                  key={day.toString()}
                  className={`
                    relative p-2 min-h-[140px] border-r border-b transition-colors
                    ${isToday ? 'bg-blue-50' : ''}
                    ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''}
                    ${isWeekend && isCurrentMonth ? 'bg-gray-25' : ''}
                  `}
                >
                  {/* 날짜 표시 */}
                  <div className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium mb-2
                    ${isToday ? 'bg-blue-500 text-white' : 
                      index % 7 === 0 ? 'text-red-600' : 
                      index % 7 === 6 ? 'text-blue-600' : 'text-gray-700'}
                    ${!isCurrentMonth ? 'text-gray-400' : ''}
                  `}>
                    {formatDate(day, 'd')}
                  </div>
                  
                  {/* 일정 목록 */}
                  <div className="space-y-1">
                    {daySchedules.map((schedule) => {
                      // 실제 멤버 데이터 구조에 맞춰 tagType 찾기
                      const tagItem = safeTagItems.find(item => item.tagName === schedule.tag);
                      const tagType = tagItem ? tagItem.tagType : (schedule.tagType || "기타");
                      const tagColor = getTagColor(tagType);
                      
                      return (
                        <div
                          key={schedule.id}
                          className={`
                            ${tagColor.bg} ${tagColor.border} border rounded-md p-2 text-xs
                            hover:shadow-md cursor-pointer transition-all transform hover:scale-105
                          `}
                          onClick={(e) => handleScheduleClick(schedule, e)}
                          title={`${schedule.start} - ${schedule.end}\n${schedule.tag} - ${schedule.title}\n${schedule.description || ''}`}
                        >
                          <div className="space-y-1">
                            {/* 1줄: 시작시간-마감시간 */}
                            <div className={`font-bold ${tagColor.text} text-left`}>
                              {schedule.start} - {schedule.end}
                            </div>
                            {/* 2줄: 태그-일정명 */}
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${tagColor.bg.replace('100', '500')} flex-shrink-0`}></div>
                              <div className={`font-medium ${tagColor.text} truncate flex-1`}>
                                {schedule.tag} | {schedule.title}
                              </div>
                            </div>
                            {/* 3줄: 설명 (있을 경우만) */}
                            {schedule.description && (
                              <div className="text-gray-600 truncate text-[10px] italic">
                                {schedule.description}
                              </div>
                            )}
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

        {/* 일정 상세보기 모달 */}
        <ScheduleDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          schedule={selectedSchedule}
          tagColor={selectedSchedule ? (() => {
            const tagItem = safeTagItems.find(item => item.tagName === selectedSchedule.tag);
            const tagType = tagItem ? tagItem.tagType : (selectedSchedule.tagType || "기타");
            return getTagColor(tagType);
          })() : PASTEL_COLORS[0]}
        />
        
        {/* ✨ 개선된 안내 메시지 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">💡 사용법</h4>
            <p className="text-blue-700 text-sm">
              {isAdminView 
                ? '일정을 클릭하면 상세 정보를 확인할 수 있습니다. 관리자 모드로 모든 편집 기능이 비활성화되어 있습니다.'
                : '일정을 클릭하면 상세 정보를 확인할 수 있습니다.'
              }
            </p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 mb-2">📊 이번 달 통계</h4>
            <div className="text-green-700 text-sm space-y-1">
              <div>총 일정: {dataStats.currentMonthSchedules}개</div>
              <div>활동 시간: {dataStats.totalTime}</div>
              <div>활동 유형: {dataStats.tagTypes}개</div>
            </div>
          </div>
        </div>

        {/* ✨ 월간 목표 달성률 표시 (데이터가 있을 때만) */}
        {allTagTypes.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🎯</span>
              {formatDate(currentDate, 'yyyy년 M월')} 목표 달성률
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTagTypes.map((tagType) => {
                const tagColor = getTagColor(tagType);
                const actualMinutes = monthlyTagTotals[tagType] || 0;
                const actualTime = minutesToTimeString(actualMinutes);
                
                // 목표 시간 찾기
                const goal = currentMonthGoalsData.find(g => g.tagType === tagType);
                const goalMinutes = goal ? parseTimeToMinutes(goal.targetHours) : 0;
                const goalTime = goal ? goal.targetHours : "00:00";
                
                // 퍼센테이지 계산
                const percentage = calculatePercentage(actualMinutes, goalMinutes);
                
                // 목표가 설정되었거나 실제 시간이 있는 것만 표시
                if (goalTime === "00:00" && actualTime === "00:00") return null;
                
                return (
                  <div key={tagType} className={`${tagColor.bg} ${tagColor.border} rounded-lg p-4 border-2`}>
                    {/* 태그명과 퍼센테이지 */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-semibold ${tagColor.text}`}>
                        {tagType}
                      </span>
                      <span className={`text-lg font-bold ${
                        percentage >= 100 ? 'text-green-600' :
                        percentage >= 70 ? 'text-blue-600' :
                        percentage >= 30 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {percentage}%
                      </span>
                    </div>
                    
                    {/* 시간 정보 */}
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>실제:</span>
                        <span className={`font-semibold ${tagColor.text}`}>{actualTime}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>목표:</span>
                        <span className={`font-semibold ${tagColor.text}`}>{goalTime}</span>
                      </div>
                    </div>
                    
                    {/* 진행률 바 */}
                    <div className="w-full bg-white rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          percentage >= 100 ? 'bg-green-500' :
                          percentage >= 75 ? 'bg-blue-500' :
                          percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* 전체 평균 달성률 */}
            {allTagTypes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 flex items-center">
                    <span className="mr-2">📈</span>
                    평균 달성률
                  </span>
                  <span className="font-bold text-xl text-gray-800">
                    {Math.round(allTagTypes.reduce((sum, tagType) => {
                      const actualMinutes = monthlyTagTotals[tagType] || 0;
                      const goal = currentMonthGoalsData.find(g => g.tagType === tagType);
                      const goalMinutes = goal ? parseTimeToMinutes(goal.targetHours) : 0;
                      const percentage = calculatePercentage(actualMinutes, goalMinutes);
                      return sum + percentage;
                    }, 0) / allTagTypes.length)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 관리자 플로팅 도구 (isAdminView일 때만) */}
      {isAdminView && onBackToDashboard && (
        <div className="fixed bottom-6 right-6 flex flex-col space-y-2">
          <button
            onClick={onBackToDashboard}
            className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition duration-200"
            title="대시보드로 돌아가기"
          >
            <span className="text-lg">🏠</span>
          </button>
          <button
            onClick={() => {
              const totalMinutes = Object.values(monthlyTagTotals).reduce((sum, minutes) => sum + minutes, 0);
              const totalTime = minutesToTimeString(totalMinutes);
              
              alert(`📊 ${currentUser}님 ${formatDate(currentDate, 'yyyy년 M월')} 요약\n\n` +
                `• 총 일정: ${safeSchedules.length}개\n` +
                `• 이번 달 일정: ${currentMonthSchedules.length}개\n` +
                `• 총 활동 시간: ${totalTime}\n` +
                `• 태그 타입: ${allTagTypes.length}개\n` +
                `• 평균 달성률: ${allTagTypes.length > 0 ? Math.round(allTagTypes.reduce((sum, tagType) => {
                  const actualMinutes = monthlyTagTotals[tagType] || 0;
                  const goal = currentMonthGoalsData.find(g => g.tagType === tagType);
                  const goalMinutes = goal ? parseTimeToMinutes(goal.targetHours) : 0;
                  const percentage = calculatePercentage(actualMinutes, goalMinutes);
                  return sum + percentage;
                }, 0) / allTagTypes.length) : 0}%\n\n` +
                `조회 시간: ${new Date().toLocaleString('ko-KR')}`
              );
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition duration-200"
            title="월별 통계 보기"
          >
            <span className="text-lg">📊</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DetailedCalendar;
