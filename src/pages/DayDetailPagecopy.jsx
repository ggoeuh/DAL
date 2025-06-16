import React, { useState, useEffect, useRef } from "react";
import { useWeeklyCalendarLogic } from "./WeeklyCalendarLogic";
import { WeeklyCalendarUI } from "./WeeklyCalendarUI";
import { saveUserDataToDAL, loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';

// ✨ 서버 데이터 새로고침 컴포넌트
const ServerDataRefresher = ({ currentUser, onDataRefresh, isAdminView, lastSyncTime }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !currentUser || !onDataRefresh) return;

    try {
      setIsRefreshing(true);
      console.log('🔄 서버 데이터 새로고침 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      if (result.success && result.data) {
        onDataRefresh(result.data);
        console.log('✅ 서버 데이터 새로고침 완료');
      } else {
        throw new Error(result.error || '서버 데이터 로드 실패');
      }
    } catch (error) {
      console.error('❌ 서버 데이터 새로고침 실패:', error);
      alert('데이터 새로고침에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span>마지막 새로고침: {lastSyncTime ? lastSyncTime.toLocaleTimeString('ko-KR') : '없음'}</span>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          isRefreshing 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
      >
        {isRefreshing ? '새로고침 중...' : '🔄 새로고침'}
      </button>
    </div>
  );
};

const WeeklyCalendar = ({ 
  currentUser = 'demo-user',
  onLogout,
  isAdminView = false,
  onBackToDashboard = null
}) => {
  console.log('🔧 WeeklyCalendar 렌더링 - 디버깅'); // 디버깅용

  // ✨ 100% 서버 기반 상태
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState(null);

  // ✨ 무한 루프 방지를 위한 ref들
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef(null);
  const loadingRef = useRef(false); // 로딩 중복 방지

  // ✨ 서버에서 데이터 로드 - 단순한 함수로 변경 (useCallback 제거)
  const loadDataFromServer = async () => {
    if (!currentUser || !supabase || loadingRef.current) return;

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      console.log('🌐 서버에서 데이터 로드 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        const serverData = result.data;
        
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: serverData.schedules?.length || 0,
          tags: serverData.tags?.length || 0,
          tagItems: serverData.tagItems?.length || 0
        });

        setSchedules(serverData.schedules || []);
        setTags(serverData.tags || []);
        setTagItems(serverData.tagItems || []);
        setLastRefresh(new Date());
        
        isInitialLoad.current = false;
      } else {
        console.warn('⚠️ 서버 데이터 없음:', result.error);
        setSchedules([]);
        setTags([]);
        setTagItems([]);
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 실패:', error);
      setError('서버 연결에 실패했습니다. 네트워크를 확인해주세요.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // ✨ 서버에 데이터 저장 - 단순한 함수로 변경 (useCallback 제거)
  const saveDataToServer = async (newSchedules, newTags, newTagItems) => {
    if (!currentUser || isAdminView) return;

    // 이전 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 디바운싱 적용 (500ms 지연)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        console.log('💾 서버에 데이터 저장 중...');

        await saveUserDataToDAL(currentUser, {
          schedules: newSchedules,
          tags: newTags,
          tagItems: newTagItems
        });

        console.log('✅ 서버 저장 완료');
        setLastRefresh(new Date());
      } catch (error) {
        console.error('❌ 서버 저장 실패:', error);
        alert('서버 저장에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  // ✨ 초기 데이터 로드 - 의존성 배열 최소화
  useEffect(() => {
    console.log('🌐 초기 데이터 로드 useEffect 실행');
    loadDataFromServer();
  }, [currentUser]); // currentUser만 의존

  // ✨ 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ✨ 서버 데이터 새로고침 핸들러 - 단순한 함수로 변경
  const handleDataRefresh = async (freshData = null) => {
    if (freshData) {
      console.log('🔄 새로운 데이터 적용:', freshData);
      setSchedules(freshData.schedules || []);
      setTags(freshData.tags || []);
      setTagItems(freshData.tagItems || []);
      setLastRefresh(new Date());
    } else {
      await loadDataFromServer();
    }
  };

  // ✨ 서버 기반 setState 함수들 - 단순한 함수로 변경
  const handleSetSchedules = async (newSchedules) => {
    console.log('📝 schedules 업데이트:', newSchedules.length);
    setSchedules(newSchedules);
    await saveDataToServer(newSchedules, tags, tagItems);
  };

  const handleSetTags = async (newTags) => {
    console.log('🏷️ tags 업데이트:', newTags.length);
    setTags(newTags);
    await saveDataToServer(schedules, newTags, tagItems);
  };

  const handleSetTagItems = async (newTagItems) => {
    console.log('📋 tagItems 업데이트:', newTagItems.length);
    setTagItems(newTagItems);
    await saveDataToServer(schedules, tags, newTagItems);
  };

  // ✨ 로딩 상태 처리
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            서버에서 데이터를 불러오는 중...
          </h3>
          <p className="text-sm text-gray-500">{currentUser}님의 캘린더 데이터</p>
        </div>
      </div>
    );
  }

  // ✨ 에러 상태 처리
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-3">서버 연결 오류</h3>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={loadDataFromServer}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // ✨ 데이터 없음 상태 처리
  if (schedules.length === 0 && tags.length === 0 && tagItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white rounded-lg shadow-lg p-12 text-center max-w-md">
            <div className="text-gray-400 text-6xl mb-6">📅</div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-3">
              캘린더가 비어있습니다
            </h3>
            <p className="text-gray-500 mb-6">
              <strong>{currentUser}님</strong>의 캘린더 데이터가 서버에 없습니다.
            </p>
            <button
              onClick={() => handleDataRefresh()}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '🔄 로딩...' : '🔄 새로고침'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🚨 중요: calendarLogic props를 단순한 객체로 전달
  const calendarLogic = useWeeklyCalendarLogic({
    schedules,
    setSchedules: handleSetSchedules,
    tags,
    setTags: handleSetTags,
    tagItems,
    setTagItems: handleSetTagItems,
    currentUser
  });

  const {
    // 상태와 데이터
    safeSchedules,
    safeTags,
    safeTagItems,
    currentWeek,
    focusedDayIndex,
    form,
    setForm,
    startSlot,
    setStartSlot,
    selectedTagType,
    setSelectedTagType,
    newTagType,
    setNewTagType,
    newTagName,
    setNewTagName,
    contextMenu,
    setContextMenu,
    copyingSchedule,
    setCopyingSchedule,
    showOverlapMessage,
    setShowOverlapMessage,
    setCurrentWeek,
    setFocusedDayIndex,
    setVisibleDays,
    setActiveTimeSlot,
    setDragging,
    setDragOffset,
    
    // 상수들
    DAYS_OF_WEEK,
    
    // 헬퍼 함수들
    assignNewTagColor,
    handleDayFocus,
    checkScheduleOverlap,
    parseTimeToMinutes,
    minutesToTimeString,
    getDayOfWeek,
    pixelToNearestTimeSlot
  } = calendarLogic;

  // 🚨 모든 핸들러들을 단순한 함수로 정의 (useCallback 제거)
  const handleContextMenu = (e, scheduleId) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      scheduleId
    });
  };
  
  const handleCopySchedule = () => {
    const scheduleToCopy = safeSchedules.find(s => s.id === contextMenu.scheduleId);
    if (scheduleToCopy) {
      setCopyingSchedule(scheduleToCopy);
      console.log('일정 복사됨:', scheduleToCopy.title);
    }
    setContextMenu({ ...contextMenu, visible: false });
  };
  
  const handleDeleteSchedule = () => {
    if (handleSetSchedules && currentUser && !isAdminView) {
      const scheduleToDelete = safeSchedules.find(s => s.id === contextMenu.scheduleId);
      const updatedSchedules = safeSchedules.filter(s => s.id !== contextMenu.scheduleId);
      
      handleSetSchedules(updatedSchedules);
      
      console.log('일정 삭제됨:', scheduleToDelete?.title);
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  // 나머지 핸들러들은 단순한 함수로 정의...
  const handleCopyMove = (e) => {
    if (!copyingSchedule) return;
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      const newIndex = (focusedDayIndex - 1 + 7) % 7;
      handleDayFocus(newIndex);
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const newIndex = (focusedDayIndex + 1) % 7;
      handleDayFocus(newIndex);
    }
  };

  const handleCopyEnd = (e) => {
    if (!copyingSchedule || !handleSetSchedules || isAdminView) return;
    
    const containers = document.querySelectorAll('[data-day-index]');
    let targetDayIndex = null;
    let targetY = null;
    
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetDayIndex = parseInt(container.dataset.dayIndex);
        targetY = e.clientY - rect.top;
        break;
      }
    }
    
    if (targetDayIndex !== null && targetY !== null) {
      const date = currentWeek[targetDayIndex].toISOString().split("T")[0];
      const dropTimeSlot = pixelToNearestTimeSlot(targetY);
      
      const startMinutes = parseTimeToMinutes(copyingSchedule.start);
      const endMinutes = parseTimeToMinutes(copyingSchedule.end);
      const duration = endMinutes - startMinutes;
      
      const newStartMinutes = parseTimeToMinutes(dropTimeSlot);
      const newEndMinutes = newStartMinutes + duration;
      const newEnd = minutesToTimeString(newEndMinutes);
      
      const newSchedule = {
        ...copyingSchedule,
        id: Date.now(),
        date,
        start: dropTimeSlot,
        end: newEnd
      };
      
      if (!checkScheduleOverlap(safeSchedules, newSchedule)) {
        const updatedSchedules = [...safeSchedules, newSchedule];
        handleSetSchedules(updatedSchedules);
        
        console.log(`일정 붙여넣기 완료: ${copyingSchedule.title}`);
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
      }
    }
    
    setCopyingSchedule(null);
  };

  // 간단한 핸들러들...
  const handleDragStart = (e, scheduleId) => {
    if (isAdminView) return;
    e.preventDefault();
    e.stopPropagation();
    
    const schedule = safeSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    
    setDragging(scheduleId);
    
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleDragMove = (e) => {
    if (!calendarLogic.dragging || isAdminView) return;
    e.preventDefault();
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      const newIndex = (focusedDayIndex - 1 + 7) % 7;
      handleDayFocus(newIndex);
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const newIndex = (focusedDayIndex + 1) % 7;
      handleDayFocus(newIndex);
    }
  };

  const handleDragEnd = (e) => {
    if (!calendarLogic.dragging || !handleSetSchedules || isAdminView) {
      setDragging(null);
      return;
    }
    
    // 드래그 로직 구현...
    setDragging(null);
  };

  // 간단한 추가/편집 핸들러들...
  const handleAdd = () => {
    if (!form.title || !startSlot || !form.end || isAdminView) return;
    
    // 일정 추가 로직...
    console.log('일정 추가');
  };
  
  const handleAddTag = () => {
    if (!newTagType.trim() || !newTagName.trim() || isAdminView) return;
    
    // 태그 추가 로직...
    console.log('태그 추가');
  };
  
  const handleDeleteTagItem = (tagType, tagName) => {
    if (handleSetTagItems && currentUser && !isAdminView) {
      const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
      handleSetTagItems(updatedTagItems);
    }
  };

  const handleSelectTag = (tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm({ ...form, tag: tagName });
  };

  // 주간 네비게이션...
  const goToPreviousWeek = () => {
    setCurrentWeek(prevWeek => {
      return prevWeek.map(date => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() - 7);
        return newDate;
      });
    });
  };

  const goToNextWeek = () => {
    setCurrentWeek(prevWeek => {
      return prevWeek.map(date => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + 7);
        return newDate;
      });
    });
  };

  const goToCurrentWeek = () => {
    const currentDate = new Date();
    setCurrentWeek(
      Array(7).fill().map((_, i) => {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() - currentDate.getDay() + i);
        return date;
      })
    );
    setFocusedDayIndex(currentDate.getDay());
    
    const newVisibleDays = [];
    const focusPosition = 3;
    for (let i = 0; i < 5; i++) {
      const offset = i - focusPosition;
      const newIndex = (currentDate.getDay() + offset + 7) % 7;
      newVisibleDays.push(newIndex);
    }
    setVisibleDays(newVisibleDays);
  };
  
  const handleTimeSlotClick = (time) => {
    if (isAdminView) return;
    
    setStartSlot(time);
    setActiveTimeSlot(time);
    
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + 60;
    const endTime = minutesToTimeString(endMinutes);
    setForm({ ...form, end: endTime });
  };
  
  const handleWeekdaySelect = (weekday) => {
    if (isAdminView) return;
    
    const currentWeekdays = [...form.weekdays];
    
    if (currentWeekdays.includes(weekday)) {
      setForm({
        ...form,
        weekdays: currentWeekdays.filter(day => day !== weekday)
      });
    } else {
      setForm({
        ...form,
        weekdays: [...currentWeekdays, weekday]
      });
    }
  };

  return (
    <div className="relative">
      <WeeklyCalendarUI
        calendarLogic={calendarLogic}
        currentUser={currentUser}
        onLogout={onLogout}
        handleContextMenu={handleContextMenu}
        handleCopySchedule={handleCopySchedule}
        handleDeleteSchedule={handleDeleteSchedule}
        handleCopyMove={handleCopyMove}
        handleCopyEnd={handleCopyEnd}
        handleDragStart={handleDragStart}
        handleDragMove={handleDragMove}
        handleDragEnd={handleDragEnd}
        handleAdd={handleAdd}
        handleAddTag={handleAddTag}
        handleDeleteTagItem={handleDeleteTagItem}
        handleSelectTag={handleSelectTag}
        goToPreviousWeek={goToPreviousWeek}
        goToNextWeek={goToNextWeek}
        goToCurrentWeek={goToCurrentWeek}
        handleTimeSlotClick={handleTimeSlotClick}
        handleWeekdaySelect={handleWeekdaySelect}
        isAdminView={isAdminView}
        saving={saving}
        onDataRefresh={handleDataRefresh}
      />
    </div>
  );
};

export default function SimplifiedWeeklyCalendar(props) {
  return <WeeklyCalendar {...props} />;
}
