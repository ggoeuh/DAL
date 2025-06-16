import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  saveUserDataToDAL, 
  loadUserDataFromDAL,
  supabase
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

// ✅ 동기화 상태 표시 컴포넌트
const SyncStatus = ({ lastSyncTime, isLoading, isSaving }) => (
  <div className="flex items-center gap-2 text-xs">
    {isSaving ? (
      <div className="text-orange-600 flex items-center gap-1">
        <div className="animate-spin w-3 h-3 border border-orange-500 border-t-transparent rounded-full"></div>
        💾 저장 중...
      </div>
    ) : isLoading ? (
      <div className="text-blue-600 flex items-center gap-1">
        <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></div>
        🔄 로딩 중...
      </div>
    ) : (
      <div className="text-green-600">✅ 동기화됨</div>
    )}
    {lastSyncTime && !isLoading && !isSaving && (
      <div className="text-gray-500">
        {format(lastSyncTime, 'HH:mm:ss')}
      </div>
    )}
  </div>
);

// 서버 데이터 리셋 버튼 컴포넌트
const ServerDataResetButton = ({ currentUser, onDataChanged, className = "" }) => {
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState('user');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!supabase || !currentUser) {
      alert('❌ Supabase 연결 또는 사용자 정보가 없습니다.');
      return;
    }

    setIsResetting(true);
    
    try {
      if (resetType === 'user') {
        if (window.confirm(
          `⚠️ ${currentUser} 사용자의 모든 서버 데이터를 삭제하시겠습니까?\n` +
          `- 모든 일정\n` +
          `- 모든 월간 목표\n\n` +
          `이 작업은 되돌릴 수 없습니다.`
        )) {
          const { error } = await supabase
            .from('DAL')
            .delete()
            .eq('user_name', currentUser);
          
          if (error) {
            throw error;
          }
          
          alert(`✅ ${currentUser} 사용자의 모든 서버 데이터가 삭제되었습니다.`);
          if (onDataChanged) onDataChanged();
        }
      } else if (resetType === 'all') {
        if (window.confirm(
          '⚠️ 모든 사용자의 서버 데이터를 삭제하시겠습니까?\n' +
          '이 작업은 되돌릴 수 없습니다.'
        )) {
          const { error } = await supabase
            .from('DAL')
            .delete()
            .neq('id', 0); // 모든 레코드 삭제
          
          if (error) {
            throw error;
          }
          
          alert('✅ 모든 서버 데이터가 삭제되었습니다.');
          if (onDataChanged) onDataChanged();
        }
      }
    } catch (error) {
      console.error('서버 데이터 삭제 실패:', error);
      alert('❌ 서버 데이터 삭제 실패: ' + error.message);
    }
    
    setIsResetting(false);
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${className}`}
        title="서버 데이터 삭제"
      >
        🗑️ 서버 삭제
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-red-600">⚠️ 서버 데이터 삭제</h3>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-3">삭제할 범위를 선택해주세요:</p>
              
              <div className="space-y-3">
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
                    <div className="font-medium">내 모든 서버 데이터 삭제</div>
                    <div className="text-sm text-gray-500">
                      {currentUser} 사용자의 모든 일정과 월간목표 삭제
                    </div>
                  </div>
                </label>
                
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
                    <div className="font-medium text-red-600">모든 서버 데이터 삭제</div>
                    <div className="text-sm text-red-500">
                      모든 사용자의 서버 데이터 삭제 (복구 불가능)
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-yellow-800 text-sm">
                <strong>주의:</strong> 서버 데이터는 한번 삭제되면 복구할 수 없습니다.
                신중하게 선택하세요.
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
                {isResetting ? '삭제 중...' : '삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const CalendarPage = ({ currentUser, onLogout }) => {
  const currentDate = new Date();
  const navigate = useNavigate();

  // 서버에서 불러온 데이터 상태
  const [schedules, setSchedules] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // ✅ 서버에서 데이터 불러오기 (useCallback으로 최적화)
  const loadDataFromServer = useCallback(async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('🔄 서버에서 사용자 데이터 불러오기 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        setSchedules(result.data.schedules || []);
        setMonthlyGoals(result.data.monthlyGoals || []);
        setTags(result.data.tags || []);
        setTagItems(result.data.tagItems || []);
        setLastSyncTime(new Date());
        
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: result.data.schedules?.length || 0,
          monthlyGoals: result.data.monthlyGoals?.length || 0,
          tags: result.data.tags?.length || 0,
          tagItems: result.data.tagItems?.length || 0
        });
      } else {
        console.warn('⚠️ 서버 데이터 로드 실패 또는 빈 데이터:', result.error);
        // 서버에 데이터가 없는 경우 빈 배열로 초기화
        setSchedules([]);
        setMonthlyGoals([]);
        setTags([]);
        setTagItems([]);
        setLastSyncTime(new Date());
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 중 오류:', error);
      alert('서버 데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // ✅ 수동 새로고침 함수
  const handleManualRefresh = useCallback(async () => {
    if (isLoading || isSaving) return;
    
    console.log('🔄 수동 새로고침 시작');
    setIsSaving(true);
    
    try {
      await loadDataFromServer();
      console.log('✅ 수동 새로고침 완료');
    } catch (error) {
      console.error('❌ 수동 새로고침 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [loadDataFromServer, isLoading, isSaving]);

  // ✅ 컴포넌트 마운트시에만 데이터 로드 (포커스 이벤트 제거)
  useEffect(() => {
    loadDataFromServer();
  }, [loadDataFromServer]);

  // ❌ 무한 동기화 원인이었던 포커스 이벤트 완전 제거
  // useEffect(() => {
  //   const handleFocus = () => {
  //     console.log('🔄 페이지 포커스 - 서버 데이터 새로고침');
  //     loadDataFromServer();
  //   };
  //
  //   const handleVisibilityChange = () => {
  //     if (!document.hidden) {
  //       handleFocus();
  //     }
  //   };
  //
  //   window.addEventListener('focus', handleFocus);
  //   document.addEventListener('visibilitychange', handleVisibilityChange);
  //
  //   return () => {
  //     window.removeEventListener('focus', handleFocus);
  //     document.removeEventListener('visibilitychange', handleVisibilityChange);
  //   };
  // }, [currentUser]);

  // 현재 월의 날짜들
  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });
  
  // 현재 월의 일정들만 필터링
  const currentMonthSchedules = schedules.filter(schedule => {
    const scheduleDate = new Date(schedule.date);
    const currentMonth = format(currentDate, 'yyyy-MM');
    const scheduleMonth = format(scheduleDate, 'yyyy-MM');
    return scheduleMonth === currentMonth;
  });

  // 현재 월의 월간 목표 가져오기
  const currentMonthGoals = monthlyGoals.find(mg => mg.month === format(currentDate, 'yyyy-MM'))?.goals || [];

  // 태그별 총 시간 계산 (실제 사용 시간)
  const calculateMonthlyTagTotals = () => {
    const totals = {};
    
    currentMonthSchedules.forEach(schedule => {
      const tagType = schedule.tagType || "기타";
      
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

  // 퍼센테이지 계산
  const calculatePercentage = (actual, goal) => {
    if (goal === 0) return 0;
    return Math.round((actual / goal) * 100);
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
    if (minutes === 0) return `${hours}h`;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h${minutes}m`;
  };

  // 태그 색상 가져오기 (기본 색상 사용)
  const getTagColor = (tagType) => {
    const index = Math.abs(tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
  };
  
  const monthlyTagTotals = calculateMonthlyTagTotals();
  
  // 목표가 있는 태그 타입들
  const goalTagTypes = currentMonthGoals.map(goal => goal.tagType);
  
  // 이번 달에 실제 사용된 태그 타입들
  const currentMonthUsedTagTypes = [...new Set(currentMonthSchedules.map(schedule => schedule.tagType || "기타"))];
  
  // 목표가 있거나 이번 달에 실제 사용된 태그타입만 표시
  const allTagTypes = [...new Set([...goalTagTypes, ...currentMonthUsedTagTypes])];
  
  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">서버에서 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }
  
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
              
              {/* ✅ 수동 새로고침 버튼 */}
              <button
                onClick={handleManualRefresh}
                disabled={isLoading || isSaving}
                className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                title="서버에서 수동 새로고침"
              >
                {isLoading || isSaving ? '🔄 로딩...' : '🔄 새로고침'}
              </button>
              
              {/* 서버 연동 상태 표시 */}
        <div className="mt-2 text-xs text-blue-600">
          <span className="font-medium">🌐 서버 연동:</span> 
          모든 데이터가 Supabase 서버에 저장됩니다. 
          페이지를 새로고침하거나 다시 접속해도 데이터가 유지됩니다.
          {lastSyncTime && (
            <span className="ml-2 text-gray-500">
              (마지막 동기화: {format(lastSyncTime, 'yyyy-MM-dd HH:mm:ss')})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
              <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                🌐 서버 연동
              </div>
              
              {/* ✅ 동기화 상태 표시 */}
              <SyncStatus 
                lastSyncTime={lastSyncTime}
                isLoading={isLoading}
                isSaving={isSaving}
              />
              
              <ServerDataResetButton 
                currentUser={currentUser} 
                onDataChanged={loadDataFromServer}
              />
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
              const goal = currentMonthGoals.find(g => g.tagType === tagType);
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
                  className={`p-4 w-60 rounded-lg border-2 ${tagColor.bg} ${tagColor.border} shadow-sm hover:shadow-md transition-shadow flex-shrink-0`}
                >
                  <div className="mb-2">
                    <span className={`font-medium ${tagColor.text}`}>{tagType}</span>
                  </div>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">실제:</span>
                      <span className={`font-semibold ${tagColor.text}`}>{actualTime}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600">목표:</span>
                      <span className={`font-semibold ${tagColor.text}`}>{goalTime}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">달성률:</span>
                      <span className={`font-bold text-lg ${getProgressColor(percentage)}`}>
                        {percentage}%
                      </span>
                    </div>
                    
                    {/* 진행률 바 */}
                    <div className="w-full bg-white rounded-full h-2 mt-2">
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
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const isWeekend = index % 7 === 0 || index % 7 === 6;
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySchedules = schedules.filter(schedule => schedule.date === dateStr);
            const dayTotalHours = getDayTotalHours(day);
            
            return (
              <div
                key={day}
                className={`
                  relative cursor-pointer p-2 min-h-[100px] border-r border-b hover:bg-gray-50 transition-colors
                  ${isToday ? 'bg-blue-50' : ''}
                  ${isWeekend ? 'bg-gray-25' : ''}
                `}
                onClick={() => navigate(`/weekly?date=${format(day, 'yyyy-MM-dd')}`)}
              >
                {/* 날짜 표시 행 */}
                <div className="flex justify-between items-center mb-2">
                  <div className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    ${isToday ? 'bg-blue-500 text-white' :
                      index % 7 === 0 ? 'text-red-600' :
                      index % 7 === 6 ? 'text-blue-600' : 'text-gray-700'}
                  `}>
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
                    const tagType = schedule.tagType || "기타";
                    const tagColor = getTagColor(tagType);
                    return (
                      <div
                        key={schedule.id}
                        className={`
                          ${tagColor.bg} ${tagColor.border} border rounded-md p-2 text-xs
                          hover:shadow-md cursor-pointer transition-all
                        `}
                        onClick={() => navigate(`/day/${format(day, 'yyyy-MM-dd')}`)}
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
          <span className="font-medium">🌐 서버 연동:</span> 
          모든 데이터가 Supabase 서버에 저장됩니다. 
          페이지를 새로고침하거나 다시 접속해도 데이터가 유지됩니다.
          {lastSyncTime && (
            <span className="ml-2 text-gray-500">
              (마지막 동기화: {format(lastSyncTime, 'yyyy-MM-dd HH:mm:ss')})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
