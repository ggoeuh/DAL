import React, { useState, useCallback, useMemo } from 'react';
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

// ✅ 동기화 상태 표시 컴포넌트 - React.memo로 최적화
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
        {format(lastSyncTime, 'HH:mm:ss')}
      </div>
    )}
  </div>
));

// ✅ 서버 데이터 리셋 버튼 컴포넌트 - React.memo로 최적화
const ServerDataResetButton = React.memo(({ currentUser, onDataChanged, className = "" }) => {
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState('user');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = useCallback(async () => {
    if (!supabase || !currentUser) {
      alert('❌ Supabase 연결 또는 사용자 정보가 없습니다.');
      return;
    }

    setIsResetting(true);
    
    try {
      if (resetType === 'user') {
        const confirmMessage = `⚠️ ${currentUser} 사용자의 모든 서버 데이터를 삭제하시겠습니까?\n- 모든 일정\n- 모든 월간 목표\n\n이 작업은 되돌릴 수 없습니다.`;
        if (window.confirm(confirmMessage)) {
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
        const confirmMessage = '⚠️ 모든 사용자의 서버 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.';
        if (window.confirm(confirmMessage)) {
          const { error } = await supabase
            .from('DAL')
            .delete()
            .neq('id', 0);
          
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
  schedules, 
  setSchedules,
  tags, // ✅ 서버에서 받아온 태그와 색상 정보
  setTags,
  tagItems,
  setTagItems,
  monthlyGoals,
  setMonthlyGoals,
  currentUser, 
  onLogout, 
  lastSyncTime 
}) => {
  const navigate = useNavigate();

  // ✅ 현재 날짜를 상태로 관리 (월 네비게이션을 위해)
  const [currentDate, setCurrentDate] = useState(new Date());

  // 로딩 상태만 로컬에서 관리
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ✅ 월 네비게이션 함수들
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prevDate => subMonths(prevDate, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // ✅ 서버 태그 색상을 우선 사용하고, 없으면 기본 색상 생성하는 함수
  // 🎨 정의된 태그(tagItems에 있는 태그)에 자동으로 색상 할당하는 로직

  const getTagColor = useCallback((tagType) => {
    // 1. 서버에서 받아온 태그 색상 정보 확인 (기존 로직)
    const serverTag = tags?.find(t => t.tagType === tagType);
    if (serverTag && serverTag.color) {
      console.log(`🎨 서버에서 받은 색상 사용: ${tagType}`, serverTag.color);
      return serverTag.color;
    }
    
    // 2. ✨ 새로운 로직: tagItems에 정의된 태그인지 확인
    const isDefinedTag = tagItems?.some(item => item.tagType === tagType);
    
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
    
    // 3. 정의되지 않은 태그는 기본 회색 (기존 로직)
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
      const existingIndex = updatedTags.findIndex(t => t.tagType === tagType);
      
      if (existingIndex >= 0) {
        // 기존 태그 업데이트
        updatedTags[existingIndex] = { ...updatedTags[existingIndex], color };
      } else {
        // 새 태그 추가
        updatedTags.push({ tagType, color });
      }
      
      // 로컬 상태 즉시 업데이트
      if (setTags) {
        setTags(updatedTags);
      }
      
      // 서버 저장 (비동기)
      if (currentUser) {
        // saveUserDataToDAL 함수를 사용하여 전체 데이터 저장
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
  }, [tags, setTags, schedules, tagItems, monthlyGoals, currentUser]);
  
  // 🔧 모든 정의된 태그에 색상을 일괄 할당하는 함수
  const assignColorsToAllDefinedTags = useCallback(async () => {
    console.log('🎨 모든 정의된 태그에 색상 일괄 할당 시작');
    
    if (!tagItems || tagItems.length === 0) {
      console.log('⚠️ 정의된 태그가 없습니다');
      return;
    }
    
    // 정의된 모든 tagType들 추출
    const definedTagTypes = [...new Set(tagItems.map(item => item.tagType))];
    console.log('🏷️ 정의된 태그 타입들:', definedTagTypes);
    
    // 현재 서버에 색상이 없는 태그들만 필터링
    const tagsWithoutColors = definedTagTypes.filter(tagType => {
      const serverTag = tags?.find(t => t.tagType === tagType);
      return !serverTag || !serverTag.color;
    });
    
    console.log('🎯 색상이 필요한 태그들:', tagsWithoutColors);
    
    if (tagsWithoutColors.length === 0) {
      console.log('✅ 모든 정의된 태그에 이미 색상이 있습니다');
      return;
    }
    
    // 각 태그에 색상 할당
    const updatedTags = [...(tags || [])];
    const usedColors = new Set(updatedTags.map(t => t.color?.bg).filter(Boolean));
    
    tagsWithoutColors.forEach((tagType, index) => {
      // 사용되지 않은 색상 찾기
      let assignedColor;
      const availableColors = PASTEL_COLORS.filter(color => !usedColors.has(color.bg));
      
      if (availableColors.length > 0) {
        assignedColor = availableColors[0];
        usedColors.add(assignedColor.bg);
      } else {
        // 모든 색상이 사용되었으면 순환
        assignedColor = PASTEL_COLORS[index % PASTEL_COLORS.length];
      }
      
      // 태그 목록에 추가
      const existingIndex = updatedTags.findIndex(t => t.tagType === tagType);
      if (existingIndex >= 0) {
        updatedTags[existingIndex] = { ...updatedTags[existingIndex], color: assignedColor };
      } else {
        updatedTags.push({ tagType, color: assignedColor });
      }
      
      console.log(`🎨 ${tagType} → ${assignedColor.bg}`);
    });
    
    // 상태 업데이트
    if (setTags) {
      setTags(updatedTags);
    }
    
    // 서버 저장
    if (currentUser) {
      const userData = {
        schedules: schedules || [],
        tags: updatedTags,
        tagItems: tagItems || [],
        monthlyGoals: monthlyGoals || []
      };
      
      try {
        const result = await saveUserDataToDAL(currentUser, userData);
        if (result.success) {
          console.log('✅ 모든 태그 색상 서버 저장 완료');
        } else {
          console.warn('⚠️ 서버 저장 실패:', result.error);
        }
      } catch (error) {
        console.error('❌ 서버 저장 중 오류:', error);
      }
    }
    
    console.log(`🎨 총 ${tagsWithoutColors.length}개 태그에 색상 할당 완료`);
  }, [tags, setTags, tagItems, schedules, monthlyGoals, currentUser]);
  
  // 🚀 컴포넌트 마운트 시 자동으로 정의된 태그들에 색상 할당
  React.useEffect(() => {
    // 데이터가 모두 로드되고 tagItems가 있을 때 실행
    if (tagItems && tagItems.length > 0 && tags !== undefined) {
      console.log('🔍 정의된 태그 색상 자동 할당 체크 시작');
      
      // 색상이 없는 정의된 태그가 있는지 확인
      const definedTagTypes = [...new Set(tagItems.map(item => item.tagType))];
      const tagsWithoutColors = definedTagTypes.filter(tagType => {
        const serverTag = tags?.find(t => t.tagType === tagType);
        return !serverTag || !serverTag.color;
      });
      
      if (tagsWithoutColors.length > 0) {
        console.log('🎯 색상이 없는 정의된 태그들 발견:', tagsWithoutColors);
        
        // 약간의 지연 후 자동 할당 (UI 로딩 완료 후)
        setTimeout(() => {
          assignColorsToAllDefinedTags();
        }, 1000);
      } else {
        console.log('✅ 모든 정의된 태그에 색상이 이미 할당되어 있음');
      }
    }
  }, [tagItems, tags, assignColorsToAllDefinedTags]);
  
  // 전역에서 접근 가능하도록 (개발/디버깅용)
  if (typeof window !== 'undefined') {
    window.assignColorsToAllDefinedTags = assignColorsToAllDefinedTags;
  }

  // ✅ 수동 새로고침 함수 - useCallback으로 최적화
  const handleManualRefresh = useCallback(async () => {
    if (isLoading || isSaving || !currentUser) return;
    
    console.log('🔄 수동 새로고침 시작');
    setIsLoading(true);
    
    try {
      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        console.log('📥 서버에서 받은 데이터:', {
          schedules: result.data.schedules?.length || 0,
          tags: result.data.tags?.length || 0,
          tagItems: result.data.tagItems?.length || 0,
          monthlyGoals: result.data.monthlyGoals?.length || 0
        });
        
        // App.jsx의 상태 업데이트 함수들 호출
        // 중복 제거 함수 (함수 안쪽에 넣어도 OK)
        const removeDuplicateSchedules = (scheduleList) => {
          const seen = new Set();
          return scheduleList.filter((s) => {
            const key = `${s.date}-${s.start}-${s.end}-${s.tagType}-${s.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };
        
        // 중복 제거 후 저장
        const cleanedSchedules = removeDuplicateSchedules(result.data.schedules || []);
        if (setSchedules) setSchedules(cleanedSchedules);
        if (setTags) setTags(result.data.tags || []);
        if (setTagItems) setTagItems(result.data.tagItems || []);
        if (setMonthlyGoals) setMonthlyGoals(result.data.monthlyGoals || []);
        
        console.log('✅ 수동 새로고침 완료');
      } else {
        console.warn('⚠️ 새로고침 데이터 없음');
      }
    } catch (error) {
      console.error('❌ 수동 새로고침 실패:', error);
      alert('새로고침 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isLoading, isSaving, setSchedules, setTags, setTagItems, setMonthlyGoals]);

  // ✅ 서버 데이터 리셋 후 콜백 - useCallback으로 최적화
  const handleDataChanged = useCallback(async () => {
    console.log('🔄 서버 데이터 변경 후 새로고침');
    await handleManualRefresh();
  }, [handleManualRefresh]);

  // ✅ 현재 월의 날짜들 - useMemo로 최적화
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });
  }, [currentDate]);
  
  // ✅ 현재 월의 일정들만 필터링 - useMemo로 최적화
  const currentMonthSchedules = useMemo(() => {
    if (!schedules) return [];
    
    const currentMonth = format(currentDate, 'yyyy-MM');
    return schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleMonth = format(scheduleDate, 'yyyy-MM');
      return scheduleMonth === currentMonth;
    });
  }, [schedules, currentDate]);

  // ✅ 현재 월의 월간 목표 가져오기 - useMemo로 최적화
  const currentMonthGoals = useMemo(() => {
    if (!monthlyGoals) return [];
    
    const currentMonth = format(currentDate, 'yyyy-MM');
    return monthlyGoals.find(mg => mg.month === currentMonth)?.goals || [];
  }, [monthlyGoals, currentDate]);

  // ✅ 태그별 총 시간 계산 - useMemo로 최적화
  const monthlyTagTotals = useMemo(() => {
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
    
    return totals;
  }, [currentMonthSchedules]);

  // ✅ 태그 타입들 - useMemo로 최적화
  const allTagTypes = useMemo(() => {
    const goalTagTypes = currentMonthGoals.map(goal => goal.tagType);
    const currentMonthUsedTagTypes = [...new Set(currentMonthSchedules.map(schedule => schedule.tagType || "기타"))];
    return [...new Set([...goalTagTypes, ...currentMonthUsedTagTypes])];
  }, [currentMonthGoals, currentMonthSchedules]);

  // 퍼센테이지 계산 함수
  const calculatePercentage = useCallback((actual, goal) => {
    if (goal === 0) return 0;
    return Math.round((actual / goal) * 100);
  }, []);

  // ✅ 특정 날짜의 총 시간 계산 - useCallback으로 최적화
  const getDayTotalHours = useCallback((date) => {
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
  }, [currentMonthSchedules]);

  // ✅ 오늘 날짜인지 확인 - useMemo로 최적화
  const today = useMemo(() => new Date(), []);

  // ✅ 디버깅 정보 출력
  React.useEffect(() => {
    console.log('🏷️ 태그 정보 상태:', {
      tags: tags?.length || 0,
      tagItems: tagItems?.length || 0,
      tagsData: tags,
      tagItemsData: tagItems
    });
  }, [tags, tagItems]);
  
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
              
              {/* 수동 새로고침 버튼 */}
              <button
                onClick={handleManualRefresh}
                disabled={isLoading || isSaving}
                className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-sm disabled:opacity-50 transition-colors"
                title="서버에서 수동 새로고침"
              >
                {isLoading || isSaving ? '🔄 로딩...' : '🔄 새로고침'}
              </button>
              
              {/* 서버 연동 상태 표시 */}
              <div className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm">
                🌐 서버 연동
              </div>
              
              {/* 동기화 상태 표시 */}
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
      
      {/* 월별 태그 요약 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">이번 달 활동 요약</h2>
        {allTagTypes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allTagTypes.map((tagType) => {
              const tagColor = getTagColor(tagType); // ✅ 서버 색상 우선 사용
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
      
      {/* ✅ 캘린더 - 월 네비게이션 추가 */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-700">캘린더</h2>
            
            {/* ✅ 월 네비게이션 버튼들 */}
            <div className="flex items-center gap-4">
              {/* 이전 달 버튼 */}
              <button
                onClick={goToPreviousMonth}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 transition-colors"
                title="이전 달"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* 현재 월 표시 및 오늘로 가기 버튼 */}
              <button
                onClick={goToCurrentMonth}
                className="px-4 py-2 text-lg font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="오늘로 가기"
              >
                {format(currentDate, 'yyyy년 M월')}
              </button>
              
              {/* 다음 달 버튼 */}
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
            const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
            const isWeekend = index % 7 === 0 || index % 7 === 6;
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySchedules = (schedules || []).filter(schedule => schedule.date === dateStr);
            const dayTotalHours = getDayTotalHours(day);
        
            return (
              <div
                key={day.toISOString()}
                className={`
                  relative cursor-pointer p-2 min-h-[100px] border-r border-b hover:bg-gray-50 transition-colors
                  ${isToday ? 'bg-blue-50' : ''}
                  ${isWeekend ? 'bg-gray-25' : ''}
                `}
                onClick={() => navigate(`/day/${format(day, 'yyyy-MM-dd')}`)}
              >
                {/* 날짜 표시 */}
                <div className="flex justify-between items-center mb-2">
                  <div className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    ${isToday ? 'bg-blue-500 text-white' :
                      index % 7 === 0 ? 'text-red-600' :
                      index % 7 === 6 ? 'text-blue-600' : 'text-gray-700'}
                  `}>
                    {format(day, 'd')}
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
                    .sort((a, b) => {
                      const [aH, aM] = a.start.split(':').map(Number);
                      const [bH, bM] = b.start.split(':').map(Number);
                      return aH * 60 + aM - (bH * 60 + bM);
                    })
                    .map((schedule) => {
                      const tagType = schedule.tagType || "기타";
                      const tagColor = getTagColor(tagType);
        
                      return (
                        <div
                          key={schedule.id || `${schedule.date}-${schedule.start}-${schedule.title}`}
                          className={`
                            ${tagColor.bg} ${tagColor.border} border rounded-md p-2 text-xs
                            hover:shadow-md cursor-pointer transition-all
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/day/${format(day, 'yyyy-MM-dd')}`);
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
                                {schedule.tag} I {schedule.title}
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
        
        {/* ✅ 서버 연동 상태 표시 - 태그 정보 포함 */}
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
        
        {/* ✅ 태그 색상 정보 표시 */}
        {tags && tags.length > 0 && (
          <div className="mt-2 text-xs text-green-600">
            <span className="font-medium">🎨 태그 색상:</span> 
            서버에서 {tags.length}개의 태그 색상 정보를 불러왔습니다.
            {tags.map(tag => tag.tagType).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPage;
