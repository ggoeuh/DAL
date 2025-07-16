import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  saveUserDataToDAL, 
  loadUserDataFromDAL,
  supabase
} from './utils/supabaseStorage.js';

// 파스텔 색상 팔레트 (서버에 색상이 없을 때 기본값으로 사용)
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

// 간단한 날짜 포맷 함수들 (date-fns 사용)
const formatDate = (date) => {
  return format(date, 'yyyy-MM-dd');
};

const formatMonth = (date) => {
  return format(date, 'yyyy-MM');
};

const formatMonthKorean = (date) => {
  return format(date, 'yyyy년 M월');
};

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
const SyncStatus = React.memo(({ lastSyncTime, isLoading, isSaving }) => (
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
        {lastSyncTime.toLocaleTimeString()}
      </div>
    )}
  </div>
));

// ✅ 데이터 복구 버튼 컴포넌트
const DataRecoveryButton = React.memo(({ currentUser, onDataChanged, className = "" }) => {
  const [isRecovering, setIsRecovering] = useState(false);

  const handleRecovery = useCallback(async () => {
    if (!currentUser) {
      alert('❌ 사용자 정보가 없습니다.');
      return;
    }

    setIsRecovering(true);
    
    try {
      console.log('🔄 데이터 복구 시작...');
      
      // 모든 데이터를 다시 불러오기 (필터링 없이)
      const { data, error } = await supabase
        .from('DAL')
        .select('*')
        .eq('user_name', currentUser)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      
      console.log('📥 복구된 원본 데이터:', data);
      
      if (data && data.length > 0) {
        alert(`✅ ${data.length}개의 레코드를 발견했습니다. 데이터를 복구합니다.`);
        if (onDataChanged) onDataChanged();
      } else {
        alert('❌ 복구할 데이터를 찾을 수 없습니다.');
      }
      
    } catch (error) {
      console.error('❌ 데이터 복구 실패:', error);
      alert('❌ 데이터 복구 실패: ' + error.message);
    }
    
    setIsRecovering(false);
  }, [currentUser, onDataChanged]);

  return (
    <button
      onClick={handleRecovery}
      disabled={isRecovering}
      className={`bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${className}`}
      title="데이터 복구 시도"
    >
      {isRecovering ? '🔄 복구 중...' : '🔧 데이터 복구'}
    </button>
  );
});

const CalendarPage = ({ 
  currentUser, 
  onLogout
}) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // ✅ 서버에서 직접 데이터 관리
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);

  // ✅ 서버에서 사용자 데이터 로드 (필터링 제거)
  const loadUserDataFromServer = useCallback(async () => {
    if (!currentUser || !supabase) return;

    try {
      setIsLoading(true);
      console.log('📥 캘린더 페이지에서 서버 데이터 로드 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        console.log('📥 서버에서 받은 데이터:', {
          schedules: result.data.schedules?.length || 0,
          tags: result.data.tags?.length || 0,
          tagItems: result.data.tagItems?.length || 0,
          monthlyGoals: result.data.monthlyGoals?.length || 0
        });
        
        // ✅ 필터링 없이 모든 일정 표시
        setSchedules(result.data.schedules || []);
        setTags(result.data.tags || []);
        setTagItems(result.data.tagItems || []);
        setMonthlyGoals(result.data.monthlyGoals || []);
        setLastSyncTime(new Date());

        console.log('📥 실제 일정 데이터:', result.data.schedules);
        console.log('📥 monthlyGoals 데이터 상세:', result.data.monthlyGoals);
      } else {
        console.warn('⚠️ 서버에서 데이터를 받아오지 못했습니다');
        setSchedules([]);
        setTags([]);
        setTagItems([]);
        setMonthlyGoals([]);
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 실패:', error);
      alert('서버에서 데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // ✅ 초기 데이터 로드
  useEffect(() => {
    if (currentUser) {
      loadUserDataFromServer();
    }
  }, [currentUser, loadUserDataFromServer]);

  // 월 네비게이션 함수들
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prevDate => subMonths(prevDate, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // 현재 월의 날짜들 - DetailedCalendar 방식으로 수정
  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
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
  }, [currentDate]);
  
  // ✅ 현재 월의 일정들만 필터링 (모든 일정 포함)
  const currentMonthSchedules = useMemo(() => {
    const currentMonth = formatMonth(currentDate);
    const filtered = schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleMonth = formatMonth(scheduleDate);
      return scheduleMonth === currentMonth;
    });
    
    console.log('📅 현재 월 일정들:', filtered);
    return filtered;
  }, [schedules, currentDate]);

  // ✅ 현재 월의 월간 목표 가져오기
  const currentMonthGoals = useMemo(() => {
    if (!monthlyGoals) return [];
    
    const currentMonth = formatMonth(currentDate);
    const currentGoal = monthlyGoals.find(mg => mg.month === currentMonth);
    const goals = currentGoal?.goals || [];
    
    console.log('🎯 현재 월 목표 계산:', {
      currentMonth,
      monthlyGoals,
      currentGoal,
      goals
    });
    
    return goals;
  }, [monthlyGoals, currentDate]);

  // ✅ 서버 태그 색상을 우선 사용하고, 없으면 기본 색상 생성하는 함수 (수정됨)
  const getTagColor = useCallback((tagOrSubTag) => {
    // 1. 먼저 해당 태그가 직접적으로 서버에 색상 정보가 있는지 확인
    const directServerTag = tags?.find(t => 
      t.tagType === tagOrSubTag || t.tag === tagOrSubTag
    );
    if (directServerTag && directServerTag.color) {
      return directServerTag.color;
    }
    
    // 2. 하위 태그인 경우, tagItems에서 해당 태그의 상위 태그(tagType)를 찾아서 색상 가져오기
    const tagItem = tagItems?.find(item => 
      item.tagName === tagOrSubTag || item.tag === tagOrSubTag
    );
    
    if (tagItem && tagItem.tagType) {
      // 상위 태그의 색상 정보 찾기
      const parentTagColor = tags?.find(t => t.tagType === tagItem.tagType);
      if (parentTagColor && parentTagColor.color) {
        return parentTagColor.color;
      }
    }
    
    // 3. 현재 월 목표에서 해당 하위 태그의 상위 태그 찾기
    const goalWithTag = currentMonthGoals?.find(goal => goal.tag === tagOrSubTag);
    if (goalWithTag && goalWithTag.tagType) {
      const parentTagColor = tags?.find(t => t.tagType === goalWithTag.tagType);
      if (parentTagColor && parentTagColor.color) {
        return parentTagColor.color;
      }
    }
    
    // 4. 일정에서 해당 하위 태그의 상위 태그 찾기
    const scheduleWithTag = schedules?.find(schedule => schedule.tag === tagOrSubTag);
    if (scheduleWithTag && scheduleWithTag.tagType) {
      const parentTagColor = tags?.find(t => t.tagType === scheduleWithTag.tagType);
      if (parentTagColor && parentTagColor.color) {
        return parentTagColor.color;
      }
    }
    
    // 5. 서버에 정의된 태그인지 확인
    const isDefinedTag = tagItems?.some(item => 
      item.tagType === tagOrSubTag || item.tagName === tagOrSubTag || item.tag === tagOrSubTag
    );
    
    if (isDefinedTag) {
      // 사용된 색상들 찾기
      const usedColors = tags?.map(t => t.color?.bg).filter(Boolean) || [];
      const availableColors = PASTEL_COLORS.filter(
        color => !usedColors.includes(color.bg)
      );
      
      let assignedColor;
      if (availableColors.length > 0) {
        assignedColor = availableColors[0];
      } else {
        const hash = tagOrSubTag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        assignedColor = PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
      }
      
      return assignedColor;
    }
    
    // 6. 기본 색상 할당 (해시 기반)
    const index = Math.abs(tagOrSubTag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
  }, [tags, tagItems, currentMonthGoals, schedules]);

  // ✅ 상위 태그별 실제 시간 계산 (모든 일정 포함)
  const tagTypeTotals = useMemo(() => {
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
    
    console.log('📊 상위 태그별 실제 시간:', totals);
    return totals;
  }, [currentMonthSchedules]);

  // ✅ 하위 태그별 총 시간 계산 (모든 일정 포함)
  const monthlyTagTotals = useMemo(() => {
    const totals = {};
    
    currentMonthSchedules.forEach(schedule => {
      const subTag = schedule.tag || "기타";
      
      if (!totals[subTag]) {
        totals[subTag] = 0;
      }
      
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const duration = endMinutes - startMinutes;
      
      totals[subTag] += duration;
    });
    
    console.log('📊 월간 태그별 실제 시간:', totals);
    return totals;
  }, [currentMonthSchedules]);

  // ✅ 하위 태그들 (모든 일정 포함)
  const allSubTags = useMemo(() => {
    const goalSubTags = currentMonthGoals.map(goal => goal.tag);
    const currentMonthUsedSubTags = [...new Set(currentMonthSchedules.map(schedule => schedule.tag || "기타"))];
    const result = [...new Set([...goalSubTags, ...currentMonthUsedSubTags])];
    
    console.log('🏷️ 전체 하위 태그 목록:', {
      goalSubTags,
      currentMonthUsedSubTags,
      result
    });
    
    return result;
  }, [currentMonthGoals, currentMonthSchedules]);

  // ✅ 상위 태그들 추출 (모든 일정 포함)
  const allTagTypes = useMemo(() => {
    const tagTypesFromGoals = currentMonthGoals.map(goal => goal.tagType || "기타");
    const tagTypesFromSchedules = [...new Set(currentMonthSchedules.map(schedule => schedule.tagType || "기타"))];
    const result = [...new Set([...tagTypesFromGoals, ...tagTypesFromSchedules])];
    
    console.log('🏷️ 전체 상위 태그 목록:', result);
    return result;
  }, [currentMonthGoals, currentMonthSchedules]);

  // 퍼센테이지 계산 함수
  const calculatePercentage = useCallback((actual, goal) => {
    if (goal === 0) return 100; // 목표가 없으면 100%
    return Math.round((actual / goal) * 100);
  }, []);

  // ✅ 특정 하위 태그의 목표 시간 찾기
  const getGoalHoursForSubTag = useCallback((subTag) => {
    const goal = currentMonthGoals.find(g => g.tag === subTag);
    
    if (goal && goal.targetHours) {
      const [hours] = goal.targetHours.split(':').map(Number);
      return hours * 60; // 분으로 변환
    }
    return 0;
  }, [currentMonthGoals]);

  // ✅ 특정 날짜의 총 시간 계산 (모든 일정 포함)
  const getDayTotalHours = useCallback((date) => {
    const dateString = formatDate(date);
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
  }, [currentMonthSchedules]);

  const today = useMemo(() => new Date(), []);

  const handleManualRefresh = useCallback(async () => {
    if (isLoading || isSaving || !currentUser) return;
    
    console.log('🔄 수동 새로고침 시작');
    await loadUserDataFromServer();
    console.log('✅ 수동 새로고침 완료');
  }, [currentUser, isLoading, isSaving, loadUserDataFromServer]);

  const handleDataChanged = useCallback(async () => {
    console.log('🔄 서버 데이터 변경 후 새로고침');
    await handleManualRefresh();
  }, [handleManualRefresh]);
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-800">
            {formatMonthKorean(currentDate)}
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
                onClick={handleManualRefresh}
                disabled={isLoading || isSaving}
                className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                title="서버에서 수동 새로고침"
              >
                {isLoading || isSaving ? '🔄 로딩...' : '🔄 새로고침'}
              </button>
              
              <DataRecoveryButton 
                currentUser={currentUser} 
                onDataChanged={handleDataChanged}
              />
              
              <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                🌐 서버 연동
              </div>
              
              <SyncStatus 
                lastSyncTime={lastSyncTime}
                isLoading={isLoading}
                isSaving={isSaving}
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
      
      {/* 월별 활동 요약 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">이번 달 활동 요약</h2>
        
        {/* 상위 태그 요약 (작은 카드들) */}
        {allTagTypes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium mb-3 text-gray-600">카테고리별 총 시간</h3>
            <div className="flex flex-wrap gap-3">
              {allTagTypes.map((tagType) => {
                const tagColor = getTagColor(tagType);
                const actualMinutes = tagTypeTotals[tagType] || 0;
                const actualHours = Math.floor(actualMinutes / 60);
                
                return (
                  <div
                    key={tagType}
                    className={`px-4 py-2 rounded-lg border ${tagColor.bg} ${tagColor.border} shadow-sm`}
                  >
                    <div className={`text-sm font-medium ${tagColor.text}`}>
                      {tagType}: {actualHours}시간
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 하위 태그 상세 */}
        {allSubTags.length > 0 ? (
          <div>
            <h3 className="text-md font-medium mb-3 text-gray-600">세부 활동별 진행률</h3>
            
            {/* 목표가 있는 태그들 (큰 카드들, 4개씩 한 행) */}
            {allSubTags.filter(subTag => getGoalHoursForSubTag(subTag) > 0).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                {allSubTags
                  .filter(subTag => getGoalHoursForSubTag(subTag) > 0)
                  .map((subTag) => {
                    const tagColor = getTagColor(subTag);
                    const actualMinutes = monthlyTagTotals[subTag] || 0;
                    const actualTime = minutesToTimeString(actualMinutes);
                    
                    const goalMinutes = getGoalHoursForSubTag(subTag);
                    const goalTime = minutesToTimeString(goalMinutes);
                    
                    const percentage = calculatePercentage(actualMinutes, goalMinutes);
                    
                    const getProgressColor = (percent) => {
                      if (percent >= 100) return "text-green-600";
                      if (percent >= 75) return "text-blue-600";
                      if (percent >= 50) return "text-yellow-600";
                      return "text-red-600";
                    };
                    
                    return (
                      <div
                        key={subTag}
                        className={`p-4 rounded-lg border-2 ${tagColor.bg} ${tagColor.border} shadow-sm hover:shadow-md transition-shadow`}
                      >
                        {/* 첫 번째 줄: 태그명과 진행률 */}
                        <div className="flex justify-between items-center mb-3">
                          <span className={`font-medium ${tagColor.text}`}>{subTag}</span>
                          <span className={`font-bold text-lg ${getProgressColor(percentage)}`}>
                            {percentage}%
                          </span>
                        </div>
                        
                        {/* 두 번째 줄: 실제시간/목표시간 */}
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">시간:</span>
                          <span className={`font-semibold text-sm ${tagColor.text}`}>
                            {actualTime} / {goalTime}
                          </span>
                        </div>
                        
                        {/* 진행률 바 */}
                        <div className="w-full bg-white rounded-full h-2 mt-3">
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
            )}
            
            {/* 목표가 없는 태그들 (작은 카드들) */}
            {allSubTags.filter(subTag => getGoalHoursForSubTag(subTag) === 0).length > 0 && (
              <div className="flex flex-wrap gap-3">
                {allSubTags
                  .filter(subTag => getGoalHoursForSubTag(subTag) === 0)
                  .map((subTag) => {
                    const tagColor = getTagColor(subTag);
                    const actualMinutes = monthlyTagTotals[subTag] || 0;
                    const actualHours = Math.floor(actualMinutes / 60);
                    
                    return (
                      <div
                        key={subTag}
                        className={`px-4 py-2 rounded-lg border ${tagColor.bg} ${tagColor.border} shadow-sm`}
                      >
                        <div className={`text-sm font-medium ${tagColor.text}`}>
                          {subTag}: {actualHours}시간
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
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
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-700">캘린더</h2>
            
            <div className="flex items-center gap-4">
              <button
                onClick={goToPreviousMonth}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 transition-colors"
                title="이전 달"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <button
                onClick={goToCurrentMonth}
                className="px-4 py-2 text-lg font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="오늘로 가기"
              >
                {formatMonthKorean(currentDate)}
              </button>
              
              <button
                onClick={goToNextMonth}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 transition-colors"
                title="다음 달"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
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
            const isToday = formatDate(day) === formatDate(today);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isWeekend = index % 7 === 0 || index % 7 === 6;
            const dateStr = formatDate(day);
            const daySchedules = schedules.filter(schedule => schedule.date === dateStr);
            const dayTotalHours = getDayTotalHours(day);
        
            return (
              <div
                key={day.toISOString()}
                className={`
                  relative cursor-pointer p-2 min-h-[140px] border-r border-b hover:bg-gray-50 transition-colors
                  ${isToday ? 'bg-blue-50' : ''}
                  ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''}
                  ${isWeekend && isCurrentMonth ? 'bg-gray-25' : ''}
                `}
                onClick={() => navigate(`/day/${formatDate(day)}`)}
              >
                {/* 날짜 표시 */}
                <div className="flex justify-between items-center mb-2">
                  <div className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    ${isToday ? 'bg-blue-500 text-white' :
                      index % 7 === 0 ? 'text-red-600' :
                      index % 7 === 6 ? 'text-blue-600' : 'text-gray-700'}
                    ${!isCurrentMonth ? 'text-gray-400' : ''}
                  `}>
                    {day.getDate()}
                  </div>
                  {dayTotalHours && (
                    <div className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {dayTotalHours}
                    </div>
                  )}
                </div>
        
                {/* 일정 목록 */}
                <div className="space-y-1">
                  {daySchedules
                    .sort((a, b) => {
                      const [aH, aM] = a.start.split(':').map(Number);
                      const [bH, bM] = b.start.split(':').map(Number);
                      return aH * 60 + aM - (bH * 60 + bM);
                    })
                    .map((schedule) => {
                      const tag = schedule.tag || "기타";
                      const tagColor = getTagColor(tag);
        
                      return (
                        <div
                          key={schedule.id || `${schedule.date}-${schedule.start}-${schedule.title}`}
                          className={`
                            ${tagColor.bg} ${tagColor.border} border rounded-md p-2 text-xs
                            hover:shadow-md cursor-pointer transition-all
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/day/${formatDate(day)}`);
                          }}
                          title={`${schedule.start} - ${schedule.end}\n${schedule.tag} - ${schedule.title}\n${schedule.description || ''}`}
                        >
                          <div className="space-y-1">
                            <div className={`font-bold ${tagColor.text} text-left`}>
                              {schedule.start} - {schedule.end}
                            </div>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${tagColor.bg.replace('100', '500')} flex-shrink-0`}></div>
                              <div className={`font-medium ${tagColor.text} truncate flex-1`}>
                                {schedule.tag} | {schedule.title}
                              </div>
                            </div>
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
        
        {lastSyncTime && (
          <div className="mt-2 text-xs text-blue-600">
            <span className="font-medium">🌐 서버 연동:</span> 
            모든 데이터가 Supabase 서버에 저장됩니다. 
            페이지를 새로고침하거나 다시 접속해도 데이터가 유지됩니다.
            <span className="ml-2 text-gray-500">
              (마지막 동기화: {format(lastSyncTime, 'yyyy-MM-dd HH:mm:ss')})
            </span>
          </div>
        )}
        
        <div className="mt-2 text-xs text-green-600">
          <span className="font-medium">🎨 하위 태그 관리:</span> 
          서버에서 {tags?.length || 0}개의 하위 태그 색상 정보를 불러왔습니다.
          구체적인 하위 활동별로 목표를 설정하고 진행률을 추적할 수 있습니다.
        </div>
        
        {/* ✅ 하위 태그 색상 정보 표시 */}
        {tags && tags.length > 0 && (
          <div className="mt-2 text-xs text-green-600">
            <span className="font-medium">🎨 하위 태그 색상:</span> 
            서버에서 {tags.length}개의 하위 태그 색상 정보를 불러왔습니다.
            {tags.map(tag => tag.tag || tag.tagType).filter(Boolean).join(', ')}
          </div>
        )}
        
        {/* 🔍 서버 연결 상태 디버깅 */}
        <div className="mt-2 text-xs text-blue-600">
          <span className="font-medium">📊 데이터 현황:</span> 
          일정 {schedules?.length || 0}개, 월간목표 {currentMonthGoals?.length || 0}개, 
          하위태그 {allSubTags?.length || 0}개 표시 중
        </div>
        
        {/* ✅ 디버깅 정보 - 목표 연동 상태 */}
        <div className="mt-2 text-xs text-purple-600">
          <span className="font-medium">🎯 목표 연동 상태:</span> 
          현재 월 목표 {currentMonthGoals.length}개 로드됨
          {currentMonthGoals.length > 0 && (
            <span className="ml-2">
              ({currentMonthGoals.map(g => `${g.tag}:${g.targetHours}`).join(', ')})
            </span>
          )}
        </div>
        
        {/* ✅ 데이터 복구 상태 표시 */}
        <div className="mt-2 text-xs text-orange-600">
          <span className="font-medium">🔧 복구 기능:</span> 
          데이터가 보이지 않으면 "데이터 복구" 버튼을 클릭하여 모든 데이터를 다시 불러올 수 있습니다.
          필터링 없이 모든 일정을 표시합니다.
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
