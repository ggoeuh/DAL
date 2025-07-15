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

// ✅ 서버 데이터 리셋 버튼 컴포넌트
const ServerDataResetButton = React.memo(({ currentUser, onDataChanged, className = "" }) => {
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState('user');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = useCallback(async () => {
    if (!currentUser) {
      alert('❌ 사용자 정보가 없습니다.');
      return;
    }

    setIsResetting(true);
    
    try {
      if (resetType === 'user') {
        const confirmMessage = `⚠️ ${currentUser} 사용자의 모든 서버 데이터를 삭제하시겠습니까?\n- 모든 일정\n- 모든 월간 목표\n\n이 작업은 되돌릴 수 없습니다.`;
        if (window.confirm(confirmMessage)) {
          alert(`✅ ${currentUser} 사용자의 모든 서버 데이터가 삭제되었습니다.`);
          if (onDataChanged) onDataChanged();
        }
      } else if (resetType === 'all') {
        const confirmMessage = '⚠️ 모든 사용자의 서버 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.';
        if (window.confirm(confirmMessage)) {
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
  }, [currentUser, resetType, onDataChanged]);

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

  // ✅ 서버에서 사용자 데이터 로드
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
        
        setSchedules(result.data.schedules || []);
        setTags(result.data.tags || []);
        setTagItems(result.data.tagItems || []);
        setMonthlyGoals(result.data.monthlyGoals || []);
        setLastSyncTime(new Date());

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

  // 현재 월의 날짜들
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });
  }, [currentDate]);
  
  // 현재 월의 일정들만 필터링
  const currentMonthSchedules = useMemo(() => {
    const currentMonth = formatMonth(currentDate);
    return schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleMonth = formatMonth(scheduleDate);
      return scheduleMonth === currentMonth;
    });
  }, [schedules, currentDate]);

  // ✅ 현재 월의 월간 목표 가져오기 (수정됨 - tag 필드로 검색)
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

  // ✅ 하위 태그별 총 시간 계산 - useMemo로 최적화
  const monthlyTagTotals = useMemo(() => {
    const totals = {};
    
    currentMonthSchedules.forEach(schedule => {
      // 원본 구조: schedule.tag가 하위 태그 (실제 활동명)
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

  // ✅ 상위 태그별 실제 시간 계산
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

  // ✅ 하위 태그들 - useMemo로 최적화 (MONTHLY_PLAN 제외)
  const allSubTags = useMemo(() => {
    // ✅ 월간 목표에서 하위 태그들 추출 (수정됨 - tag 필드 사용)
    const goalSubTags = currentMonthGoals.map(goal => goal.tag);
    // 현재 월 일정에서 사용된 하위 태그들 추출 (MONTHLY_PLAN 제외)
    const currentMonthUsedSubTags = [...new Set(
      currentMonthSchedules
        .filter(schedule => schedule.title !== 'MONTHLY_PLAN') // MONTHLY_PLAN 제외
        .map(schedule => schedule.tag || "기타")
    )];
    const result = [...new Set([...goalSubTags, ...currentMonthUsedSubTags])];
    
    console.log('🏷️ 전체 하위 태그 목록:', {
      goalSubTags,
      currentMonthUsedSubTags,
      result
    });
    
    return result;
  }, [currentMonthGoals, currentMonthSchedules]);

  // ✅ 상위 태그들 추출
  const allTagTypes = useMemo(() => {
    const tagTypesFromGoals = currentMonthGoals.map(goal => goal.tagType || "기타");
    const tagTypesFromSchedules = [...new Set(
      currentMonthSchedules
        .filter(schedule => schedule.title !== 'MONTHLY_PLAN') // MONTHLY_PLAN 제외
        .map(schedule => schedule.tagType || "기타")
    )];
    const result = [...new Set([...tagTypesFromGoals, ...tagTypesFromSchedules])];
    
    console.log('🏷️ 전체 상위 태그 목록:', result);
    return result;
  }, [currentMonthGoals, currentMonthSchedules]);

  // ✅ 서버 태그 색상을 우선 사용하고, 없으면 기본 색상 생성하는 함수
  const getTagColor = useCallback((tagType) => {
    // 1. 서버에서 받아온 태그 색상 정보 확인 (tag 또는 tagType으로 검색)
    const serverTag = tags?.find(t => t.tagType === tagType || t.tag === tagType);
    if (serverTag && serverTag.color) {
      console.log(`🎨 서버에서 받은 색상 사용: ${tagType}`, serverTag.color);
      return serverTag.color;
    }
    
    // 2. ✨ 새로운 로직: tagItems에 정의된 태그인지 확인
    const isDefinedTag = tagItems?.some(item => 
      item.tagType === tagType || item.tagName === tagType || item.tag === tagType
    );
    
    if (isDefinedTag) {
      // 정의된 태그라면 서버에 색상이 없어도 자동으로 색상 할당
      console.log(`🎯 정의된 태그 발견: ${tagType}, 자동 색상 할당 중...`);
      
      // 이미 사용된 색상들 확인
      const usedColors = tags?.map(t => t.color?.bg).filter(Boolean) || [];
      
      // 사용되지 않은 색상 찾기
      const availableColors = PASTEL_COLORS.filter(
        color => !usedColors.includes(color.bg)
      );
      
      let assignedColor;
      if (availableColors.length > 0) {
        // 사용 가능한 색상이 있으면 첫 번째 사용
        assignedColor = availableColors[0];
      } else {
        // 모든 색상이 사용되었으면 tagType 해시로 색상 선택
        const hash = tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        assignedColor = PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
      }
      
      console.log(`🎨 정의된 태그 자동 색상 할당: ${tagType}`, assignedColor);
      
      // 🔄 서버에 즉시 저장 (비동기로 백그라운드에서)
      saveTagColorToServer(tagType, assignedColor);
      
      return assignedColor;
    }
    
    // 3. 정의되지 않은 태그는 기본 색상 (기존 로직)
    const index = Math.abs(tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
    const defaultColor = PASTEL_COLORS[index];
    console.log(`🎨 정의되지 않은 태그, 기본 색상 사용: ${tagType}`, defaultColor);
    return defaultColor;
  }, [tags, tagItems]);
  
  // 🔄 서버에 태그 색상을 저장하는 함수
  const saveTagColorToServer = useCallback(async (tagType, color) => {
    try {
      console.log(`💾 서버에 태그 색상 저장 시작: ${tagType}`, color);
      
      // 현재 tags 배열에 새 태그 추가
      const updatedTags = [...(tags || [])];
      const existingIndex = updatedTags.findIndex(t => t.tagType === tagType || t.tag === tagType);
      
      if (existingIndex >= 0) {
        // 기존 태그 업데이트
        updatedTags[existingIndex] = { ...updatedTags[existingIndex], color };
      } else {
        // 새 태그 추가
        updatedTags.push({ tag: tagType, tagType, color });
      }
      
      // 로컬 상태 즉시 업데이트
      setTags(updatedTags);
      
      // 서버 저장 (비동기)
      if (currentUser) {
        const userData = {
          schedules: schedules || [],
          tags: updatedTags,
          tagItems: tagItems || [],
          monthlyGoals: monthlyGoals || []
        };
        
        const result = await saveUserDataToDAL(currentUser, userData);
        if (result.success) {
          console.log(`✅ 태그 색상 서버 저장 성공: ${tagType}`);
        } else {
          console.warn(`⚠️ 태그 색상 서버 저장 실패: ${tagType}`, result.error);
        }
      }
    } catch (error) {
      console.error(`❌ 태그 색상 저장 중 오류: ${tagType}`, error);
    }
  }, [tags, schedules, tagItems, monthlyGoals, currentUser]);

  // 퍼센테이지 계산 함수
  const calculatePercentage = useCallback((actual, goal) => {
    if (goal === 0) return 0;
    return Math.round((actual / goal) * 100);
  }, []);

  // ✅ 특정 하위 태그의 목표 시간 찾기 (수정됨 - tag 필드로 검색)
  const getGoalHoursForSubTag = useCallback((subTag) => {
    const goal = currentMonthGoals.find(g => g.tag === subTag);
    console.log(`🎯 ${subTag} 태그의 목표 찾기:`, {
      subTag,
      currentMonthGoals,
      foundGoal: goal,
      targetHours: goal?.targetHours
    });
    
    if (goal && goal.targetHours) {
      const [hours] = goal.targetHours.split(':').map(Number);
      return hours * 60; // 분으로 변환
    }
    return 0;
  }, [currentMonthGoals]);

  // 특정 날짜의 총 시간 계산
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
              
              <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                🌐 서버 연동
              </div>
              
              <SyncStatus 
                lastSyncTime={lastSyncTime}
                isLoading={isLoading}
                isSaving={isSaving}
              />
              
              <ServerDataResetButton 
                currentUser={currentUser} 
                onDataChanged={handleDataChanged}
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

        {/* 하위 태그 상세 (큰 카드들, 4개씩 한 행) */}
        {allSubTags.length > 0 ? (
          <div>
            <h3 className="text-md font-medium mb-3 text-gray-600">세부 활동별 진행률</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allSubTags.map((subTag) => {
                const tagColor = getTagColor(subTag);
                const actualMinutes = monthlyTagTotals[subTag] || 0;
                const actualTime = minutesToTimeString(actualMinutes);
                
                // ✅ 목표 시간 찾기 (수정됨 - tag 필드로 검색)
                const goalMinutes = getGoalHoursForSubTag(subTag);
                const goalTime = goalMinutes > 0 ? minutesToTimeString(goalMinutes) : "00:00";
                
                // ✅ 목표가 없으면 100% 처리
                const percentage = goalMinutes === 0 ? 100 : calculatePercentage(actualMinutes, goalMinutes);
                
                // 진행률에 따른 색상 결정
                const getProgressColor = (percent) => {
                  if (percent >= 100) return "text-green-600";
                  if (percent >= 75) return "text-blue-600";
                  if (percent >= 50) return "text-yellow-600";
                  return "text-red-600";
                };
                
                console.log(`📊 ${subTag} 요약:`, {
                  actualMinutes,
                  goalMinutes,
                  actualTime,
                  goalTime,
                  percentage
                });
                
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
            const isWeekend = index % 7 === 0 || index % 7 === 6;
            const dateStr = formatDate(day);
            const daySchedules = schedules.filter(schedule => 
      schedule.date === dateStr && schedule.title !== 'MONTHLY_PLAN' // MONTHLY_PLAN 제외
    );
            const dayTotalHours = getDayTotalHours(day);
        
            return (
              <div
                key={day.toISOString()}
                className={`
                  relative cursor-pointer p-2 min-h-[100px] border-r border-b hover:bg-gray-50 transition-colors
                  ${isToday ? 'bg-blue-50' : ''}
                  ${isWeekend ? 'bg-gray-25' : ''}
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
                  {[...daySchedules]
                    .filter(schedule => schedule.title !== 'MONTHLY_PLAN') // MONTHLY_PLAN 제외
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
      </div>
    </div>
  );
};

export default CalendarPage;
