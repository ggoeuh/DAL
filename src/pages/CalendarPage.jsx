import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  saveUserDataToDAL, 
  loadUserDataFromDAL 
} from './utils/supabaseStorage.js';

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

// 시간을 분으로 변환하는 함수
const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// 분을 시간 형식으로 변환하는 함수
const minutesToTimeString = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

// 데이터 초기화 버튼 컴포넌트
const DataResetButton = ({ currentUser, className = "" }) => {
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState('cleanup');
  const [isResetting, setIsResetting] = useState(false);

  const resetFunctions = {
    cleanup: (nickname) => {
      if (!nickname) return;
      
      if (window.confirm(${nickname} 사용자의 불일치 데이터를 정리하시겠습니까?)) {
        console.log(🧹 ${nickname} 사용자의 고아 데이터 정리 시작);
        
        const schedules = JSON.parse(localStorage.getItem(${nickname}-schedules) || '[]');
        const tags = JSON.parse(localStorage.getItem(${nickname}-tags) || '[]');
        const tagItems = JSON.parse(localStorage.getItem(${nickname}-tagItems) || '[]');
        const monthlyGoals = JSON.parse(localStorage.getItem(${nickname}-monthlyGoals) || '[]');
        
        // 실제 사용되지 않는 태그 타입 찾기
        const usedTagTypes = [...new Set(tagItems.map(item => item.tagType))];
        const unusedTags = tags.filter(tag => !usedTagTypes.includes(tag.tagType));
        
        if (unusedTags.length > 0) {
          const cleanedTags = tags.filter(tag => usedTagTypes.includes(tag.tagType));
          localStorage.setItem(${nickname}-tags, JSON.stringify(cleanedTags));
          console.log(  🗑️ 사용되지 않는 태그 타입 ${unusedTags.length}개 삭제);
        }
        
        // 실제 태그 항목이 없는 월간 목표 찾기
        const validTagTypes = [...new Set(tagItems.map(item => item.tagType))];
        const validGoals = monthlyGoals.map(monthGoal => ({
          ...monthGoal,
          goals: monthGoal.goals.filter(goal => validTagTypes.includes(goal.tagType))
        })).filter(monthGoal => monthGoal.goals.length > 0);
        
        if (JSON.stringify(validGoals) !== JSON.stringify(monthlyGoals)) {
          localStorage.setItem(${nickname}-monthlyGoals, JSON.stringify(validGoals));
          console.log(  🗑️ 유효하지 않은 월간 목표 정리 완료);
        }
        
        console.log(🧹 ${nickname} 사용자 고아 데이터 정리 완료);
        alert('✅ 데이터 정리가 완료되었습니다.');
        window.location.reload();
      }
    },

    userComplete: (nickname) => {
      if (!nickname) return;
      
      if (window.confirm(
        ⚠️ ${nickname} 사용자의 모든 데이터를 완전히 삭제하시겠습니까?\n +
        - 모든 일정\n +
        - 모든 태그\n +
        - 모든 월간 계획\n +
        - 모든 월간 목표\n\n +
        이 작업은 되돌릴 수 없습니다.
      )) {
        const keysToDelete = [
          ${nickname}-schedules,
          ${nickname}-tags,
          ${nickname}-tagItems,
          ${nickname}-monthlyPlans,
          ${nickname}-monthlyGoals,
          ${nickname}-tagTotals
        ];
        
        keysToDelete.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(  ✅ 삭제됨: ${key});
          }
        });
        
        alert(✅ ${nickname} 사용자의 모든 데이터가 완전히 삭제되었습니다.);
        window.location.reload();
      }
    },

    calendar: () => {
      if (window.confirm('⚠️ 모든 사용자의 캘린더 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        const calendarKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes('schedules') ||
            key.includes('tags') ||
            key.includes('tagItems') ||
            key.includes('monthlyPlans') ||
            key.includes('monthlyGoals')
          )) {
            calendarKeys.push(key);
          }
        }
        
        calendarKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        alert(✅ 모든 캘린더 데이터가 초기화되었습니다. (${calendarKeys.length}개 항목 삭제));
        window.location.reload();
      }
    },

    all: () => {
      if (window.confirm('⚠️ 경고: 모든 localStorage 데이터가 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.\n정말로 진행하시겠습니까?')) {
        localStorage.clear();
        alert('✅ 모든 데이터가 완전히 초기화되었습니다.');
        window.location.reload();
      }
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    
    try {
      if (resetType === 'cleanup' && currentUser) {
        resetFunctions.cleanup(currentUser);
      } else if (resetType === 'user' && currentUser) {
        resetFunctions.userComplete(currentUser);
      } else if (resetType === 'all') {
        resetFunctions.calendar();
      } else if (resetType === 'complete') {
        resetFunctions.all();
      }
    } catch (error) {
      console.error('초기화 중 오류:', error);
      alert('❌ 초기화 중 오류가 발생했습니다.');
    }
    
    setIsResetting(false);
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${className}}
        title="데이터 초기화"
      >
        🗑️ 초기화
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-red-600">⚠️ 데이터 초기화</h3>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-3">초기화할 범위를 선택해주세요:</p>
              
              <div className="space-y-3">
                {currentUser && (
                  <>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="resetType"
                        value="cleanup"
                        checked={resetType === 'cleanup'}
                        onChange={(e) => setResetType(e.target.value)}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium text-blue-600">불일치 데이터 정리</div>
                        <div className="text-sm text-gray-500">
                          {currentUser} 사용자의 고아 데이터만 정리 (추천)
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="resetType"
                        value="user"
                        checked={resetType === 'user'}
                        onChange={(e) => setResetType(e.target.value)}
                        className="mr-2"
                      />
                      <div>
                        <div className="font-medium">내 모든 데이터 삭제</div>
                        <div className="text-sm text-gray-500">
                          {currentUser} 사용자의 일정, 태그, 월간계획, 월간목표 모두 삭제
                        </div>
                      </div>
                    </label>
                  </>
                )}
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="resetType"
                    value="all"
                    checked={resetType === 'all'}
                    onChange={(e) => setResetType(e.target.value)}
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium">모든 캘린더 데이터 초기화</div>
                    <div className="text-sm text-gray-500">
                      모든 사용자의 일정, 태그, 월간계획 삭제
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="resetType"
                    value="complete"
                    checked={resetType === 'complete'}
                    onChange={(e) => setResetType(e.target.value)}
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium text-red-600">완전 초기화</div>
                    <div className="text-sm text-red-500">
                      모든 localStorage 데이터 삭제 (복구 불가능)
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-yellow-800 text-sm">
                <strong>주의:</strong> "불일치 데이터 정리"를 먼저 시도해보세요. 
                문제가 해결되지 않으면 더 강한 옵션을 선택하세요.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isResetting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isResetting ? '처리 중...' : '실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const CalendarPage = ({ 
  schedules = [], 
  tags = [], 
  tagItems = [], 
  currentUser, 
  onLogout
}) => {
  const currentDate = new Date();
  const navigate = useNavigate();

  // 안전한 배열 보장
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];

  // 서버 백업/복원 상태 (제거)
  // const [isBackingUp, setIsBackingUp] = useState(false);
  // const [isRestoring, setIsRestoring] = useState(false);

  // 간단한 월간 목표 상태
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  
  // 현재 월의 날짜들
  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });
  
  // 현재 월의 일정들만 필터링
  const currentMonthSchedules = safeSchedules.filter(schedule => {
    const scheduleDate = new Date(schedule.date);
    const currentMonth = format(currentDate, 'yyyy-MM');
    const scheduleMonth = format(scheduleDate, 'yyyy-MM');
    return scheduleMonth === currentMonth;
  });
  
  // 서버 백업/복원 함수들 (자동화로 인해 제거)
  // 모든 저장/로딩은 Appcopy.jsx에서 자동으로 처리됩니다.

  // 태그별 총 시간 계산 (실제 사용 시간)
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

  // 간단한 월간 목표 불러오기 (로컬스토리지에서 직접)
  const loadMonthlyGoals = () => {
    if (!currentUser) return [];
    
    try {
      const currentMonthKey = format(currentDate, 'yyyy-MM');
      const key = ${currentUser}-monthlyGoals;
      const data = localStorage.getItem(key);
      
      if (data) {
        const allGoals = JSON.parse(data);
        const found = allGoals.find(goal => goal.month === currentMonthKey);
        return found?.goals || [];
      }
    } catch (error) {
      console.error('월간 목표 불러오기 실패:', error);
    }
    
    return [];
  };

  // 페이지 로드시 한 번만 목표 불러오기 + 포커스 이벤트로 새로고침
  useEffect(() => {
    const loadGoals = () => {
      const goals = loadMonthlyGoals();
      setMonthlyGoals(goals);
      console.log('캘린더 목표 로드:', { currentUser, goalsCount: goals.length });
    };

    loadGoals();

    // 페이지 포커스시 목표 새로고침 (MonthlyPlan에서 돌아올 때)
    const handleFocus = () => {
      console.log('페이지 포커스 - 목표 새로고침');
      loadGoals();
    };

    // storage 변화 감지
    const handleStorageChange = (e) => {
      if (e.key && e.key.includes('monthlyGoals') && e.key.includes(currentUser)) {
        console.log('storage 변화 감지 - 목표 새로고침');
        setTimeout(() => loadGoals(), 100);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        handleFocus();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [currentUser]);

  // 퍼센테이지 계산
  const calculatePercentage = (actual, goal) => {
    if (goal === 0) return 0;
    return Math.round((actual / goal) * 100);
  };
  
  // 특정 날짜에 일정이 있는지 확인
  const hasScheduleOnDate = (date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return currentMonthSchedules.some(schedule => schedule.date === dateString);
  };
  
  // 특정 날짜의 일정 개수 반환
  const getScheduleCountOnDate = (date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return currentMonthSchedules.filter(schedule => schedule.date === dateString).length;
  };

  // 특정 날짜의 총 시간 계산
  const getDayTotalHours = (date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const daySchedules = currentMonthSchedules.filter(schedule => schedule.date === dateString);
    
    const totalMinutes = daySchedules.reduce((total, schedule) => {
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      return total + (endMinutes - startMinutes);
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0 && minutes === 0) return '';
    if (minutes === 0) return ${hours}h;
    if (hours === 0) return ${minutes}m;
    return ${hours}h${minutes}m;
  };

  // 특정 날짜의 태그 목록 가져오기
  const getDayTags = (date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const daySchedules = currentMonthSchedules.filter(schedule => schedule.date === dateString);
    
    const tagCounts = {};
    daySchedules.forEach(schedule => {
      const tagItem = safeTagItems.find(item => item.tagName === schedule.tag);
      const tagType = tagItem ? tagItem.tagType : (schedule.tagType || "기타");
      tagCounts[tagType] = (tagCounts[tagType] || 0) + 1;
    });
    
    return Object.entries(tagCounts).map(([tagType, count]) => ({
      tagType,
      count,
      color: getTagColor(tagType)
    }));
  };
  
  // 태그 색상 가져오기
  const getTagColor = (tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : PASTEL_COLORS[0];
  };
  
  const monthlyTagTotals = calculateMonthlyTagTotals();
  
  // 고유한 태그 타입들 가져오기 (목표가 있는 것만!)
  const usedTagTypes = [...new Set(safeTagItems.map(item => item.tagType))];
  const goalTagTypes = monthlyGoals.map(goal => goal.tagType);
  
  // 실제로 이번 달에 사용된 태그 타입들
  const currentMonthUsedTagTypes = [...new Set(currentMonthSchedules.map(schedule => {
    const tagItem = safeTagItems.find(item => item.tagName === schedule.tag);
    return tagItem ? tagItem.tagType : (schedule.tagType || "기타");
  }))];
  
  // 목표가 있거나 이번 달에 실제 사용된 태그타입만 표시
  const allTagTypes = [...new Set([...goalTagTypes, ...currentMonthUsedTagTypes])];
  
  console.log('태그 타입 디버깅:', {
    goalTagTypes,
    currentMonthUsedTagTypes, 
    allTagTypes,
    monthlyGoalsLength: monthlyGoals.length
  });
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-800">
            {format(currentDate, 'yyyy년 M월')}
          </h1>
          {currentUser && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🧑‍💻 {currentUser}</span>
              <button
                onClick={onLogout}
                className="text-red-500 hover:text-red-700 underline"
              >
                로그아웃
              </button>
              <button
                onClick={() => {
                  const goals = loadMonthlyGoals();
                  setMonthlyGoals(goals);
                  console.log('수동 새로고침 완료');
                }}
                className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-sm"
                title="월간 목표 새로고침"
              >
                🔄 새로고침
              </button>
              
              {/* 자동 저장 상태 표시 */}
              <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">
                🌐 자동 저장 활성
              </div>
              
              <DataResetButton currentUser={currentUser} />
            </div>
          )}
        </div>
        
        <button
          onClick={() => navigate('/monthly-plan')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          월간 계획
        </button>
      </div>
      
      {/* 월별 태그 요약 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">이번 달 활동 요약</h2>
        {allTagTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allTagTypes.map((tagType) => {
              const tagColor = getTagColor(tagType);
              const actualMinutes = monthlyTagTotals[tagType] || 0;
              const actualTime = minutesToTimeString(actualMinutes);
              
              // 목표 시간 찾기
              const goal = monthlyGoals.find(g => g.tagType === tagType);
              const goalMinutes = goal ? parseTimeToMinutes(goal.targetHours) : 0;
              const goalTime = goal ? goal.targetHours : "00:00";
              
              // 퍼센테이지 계산
              const percentage = calculatePercentage(actualMinutes, goalMinutes);
              
              // 진행률에 따른 색상 결정
              const getProgressColor = (percent) => {
                if (percent >= 100) return "text-green-600";
                if (percent >= 75) return "text-blue-600";
                if (percent >= 50) return "text-yellow-600";
                return "text-red-600";
              };
              
              return (
                <div
                  key={tagType}
                  className={p-4 w-60 rounded-lg border-2 ${tagColor.bg} ${tagColor.border} shadow-sm hover:shadow-md transition-shadow flex-shrink-0}
                >
                  <div className="mb-2">
                    <span className={font-medium ${tagColor.text}}>{tagType}</span>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">실제:</span>
                      <span className={font-semibold ${tagColor.text}}>{actualTime}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">목표:</span>
                      <span className={font-semibold ${tagColor.text}}>{goalTime}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">달성률:</span>
                      <span className={font-bold text-lg ${getProgressColor(percentage)}}>
                        {percentage}%
                      </span>
                    </div>
                    
                    {/* 진행률 바 */}
                    <div className="w-full bg-white rounded-full h-2 mt-2">
                      <div 
                        className={h-2 rounded-full transition-all duration-300 ${
                          percentage >= 100 ? 'bg-green-500' :
                          percentage >= 75 ? 'bg-blue-500' :
                          percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }}
                        style={{ width: ${Math.min(percentage, 100)}% }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">아직 등록된 일정이 없습니다.</p>
            <p className="text-sm mt-2">일정을 추가하여 월별 활동을 확인해보세요!</p>
          </div>
        )}
      </div>
      
      {/* 캘린더 */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-700">캘린더</h2>
        </div>
        
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 bg-gray-100 border-b">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <div key={day} className={p-3 text-center font-medium ${
              index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
            }}>
              {day}
            </div>
          ))}
        </div>
        
        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const isWeekend = index % 7 === 0 || index % 7 === 6;
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySchedules = schedules.filter(schedule => schedule.date === dateStr);
            const dayTotalHours = getDayTotalHours(day);
            
            return (
              <div
                key={day}
                className={
                  relative cursor-pointer p-2 min-h-[100px] border-r border-b hover:bg-gray-50 transition-colors
                  ${isToday ? 'bg-blue-50' : ''}
                  ${isWeekend ? 'bg-gray-25' : ''}
                }
                onClick={() => navigate(/day/${format(day, 'yyyy-MM-dd')})}
              >
                {/* 날짜 표시 행 */}
                <div className="flex justify-between items-center mb-2">
                  <div className={
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    ${isToday ? 'bg-blue-500 text-white' :
                      index % 7 === 0 ? 'text-red-600' :
                      index % 7 === 6 ? 'text-blue-600' : 'text-gray-700'}
                  }>
                    {format(day, 'd')}
                  </div>
                  {/* 총 시간 표시 */}
                  {dayTotalHours && (
                    <div className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {dayTotalHours}
                    </div>
                  )}
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
                        className={
                          ${tagColor.bg} ${tagColor.border} border rounded-md p-2 text-xs
                          hover:shadow-md cursor-pointer transition-all
                        }
                        onClick={() => navigate(/day/${format(day, 'yyyy-MM-dd')})}
                        title={${schedule.start} - ${schedule.end}\n${schedule.tag} - ${schedule.title}\n${schedule.description || ''}}
                      >
                        <div className="space-y-1">
                          {/* 1줄: 시작시간-마감시간 */}
                          <div className={font-bold ${tagColor.text} text-left}>
                            {schedule.start} - {schedule.end}
                          </div>
                          {/* 2줄: 태그-일정명 */}
                          <div className="flex items-center gap-1">
                            <div className={w-2 h-2 rounded-full ${tagColor.bg.replace('100', '500')} flex-shrink-0}></div>
                            <div className={font-medium ${tagColor.text} truncate flex-1}>
                              {schedule.tag} I {schedule.title}
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
      
      {/* 안내 메시지 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-blue-800 text-sm">
          <span className="font-medium">💡 팁:</span> 날짜를 클릭하면 해당 날짜의 상세 일정을 확인할 수 있습니다.
        </p>
        
        {/* 서버 연동 상태 표시 */}
        <div className="mt-2 text-xs text-blue-600">
          <span className="font-medium">🌐 자동 저장 활성:</span> 
          데이터가 자동으로 로컬과 서버에 저장됩니다. 
          별도의 저장 버튼 없이도 모든 변경사항이 실시간으로 백업됩니다.
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
