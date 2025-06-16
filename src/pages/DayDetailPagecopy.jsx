import React, { useState, useEffect } from "react";
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
  // ✨ 100% 서버 기반 상태 (로컬 저장 완전 제거)
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState(null);

  // ✨ 서버에서 데이터 로드
  const loadDataFromServer = async () => {
    if (!currentUser || !supabase) return;

    try {
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
    }
  };

  // ✨ 서버에 데이터 저장
  const saveDataToServer = async (newSchedules, newTags, newTagItems) => {
    if (!currentUser || isAdminView) return;

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
      // 저장 실패 시 서버에서 다시 로드
      await loadDataFromServer();
    } finally {
      setSaving(false);
    }
  };

  // ✨ 초기 데이터 로드
  useEffect(() => {
    console.log('🌐 100% 서버 기반 모드 - 서버에서 데이터 로드');
    loadDataFromServer();
  }, [currentUser]);

  // ✨ 서버 데이터 새로고침 핸들러
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

  // ✨ 서버 기반 setSchedules (즉시 서버 저장)
  const handleSetSchedules = async (newSchedules) => {
    setSchedules(newSchedules);
    await saveDataToServer(newSchedules, tags, tagItems);
  };

  // ✨ 서버 기반 setTags (즉시 서버 저장)
  const handleSetTags = async (newTags) => {
    setTags(newTags);
    await saveDataToServer(schedules, newTags, tagItems);
  };

  // ✨ 서버 기반 setTagItems (즉시 서버 저장)
  const handleSetTagItems = async (newTagItems) => {
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
                    👑 {currentUser}님의 주간 캘린더
                  </h1>
                  <p className="text-red-200 text-sm">관리자 모드 - 100% 서버 기반</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <ServerDataRefresher 
                  currentUser={currentUser}
                  onDataRefresh={handleDataRefresh}
                  isAdminView={isAdminView}
                  lastSyncTime={lastRefresh}
                />
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
              캘린더가 비어있습니다
            </h3>
            <p className="text-gray-500 mb-6">
              <strong>{currentUser}님</strong>의 캘린더 데이터가 서버에 없습니다.
              {isAdminView ? ' 사용자가 아직 일정을 등록하지 않았습니다.' : ' 첫 번째 일정을 추가해보세요!'}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
              <h4 className="font-semibold mb-2">💡 안내</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 모든 데이터는 Supabase 서버에 실시간 저장됩니다</li>
                <li>• 로컬 저장소는 사용하지 않습니다</li>
                {isAdminView ? (
                  <>
                    <li>• 관리자 모드에서는 읽기만 가능합니다</li>
                    <li>• 사용자가 직접 로그인하여 일정을 추가해야 합니다</li>
                  </>
                ) : (
                  <>
                    <li>• 일정 추가/수정/삭제가 즉시 서버에 반영됩니다</li>
                    <li>• 네트워크 연결이 필요합니다</li>
                  </>
                )}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDataRefresh()}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? '🔄 로딩...' : '🔄 새로고침'}
              </button>
              {onBackToDashboard && (
                <button
                  onClick={onBackToDashboard}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  돌아가기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 로직 훅 사용
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

  // 추가 핸들러들 정의
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

  // 복사 관련 핸들러들
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
        
        console.log(`일정 붙여넣기 완료: ${copyingSchedule.title} -> ${getDayOfWeek(currentWeek[targetDayIndex])} ${dropTimeSlot}-${newEnd}`);
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
      }
    }
    
    setCopyingSchedule(null);
  };

  // 드래그 관련 핸들러들
  const handleDragStart = (e, scheduleId) => {
    if (isAdminView) return; // 관리자 모드에서는 드래그 비활성화
    
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
      const schedule = safeSchedules.find(s => s.id === calendarLogic.dragging);
      if (!schedule) {
        setDragging(null);
        return;
      }
      
      const newDate = currentWeek[targetDayIndex].toISOString().split("T")[0];
      const newStartTime = pixelToNearestTimeSlot(targetY - calendarLogic.dragOffset.y);
      
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const duration = endMinutes - startMinutes;
      
      const newStartMinutes = parseTimeToMinutes(newStartTime);
      const newEndMinutes = newStartMinutes + duration;
      const newEndTime = minutesToTimeString(newEndMinutes);
      
      const updatedSchedule = {
        ...schedule,
        date: newDate,
        start: newStartTime,
        end: newEndTime
      };
      
      if (!checkScheduleOverlap(safeSchedules, updatedSchedule)) {
        const updatedSchedules = safeSchedules.map(s => 
          s.id === calendarLogic.dragging ? updatedSchedule : s
        );
        handleSetSchedules(updatedSchedules);
        
        console.log(`일정 이동 완료: ${schedule.title}`);
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
      }
    }
    
    setDragging(null);
  };

  // 일정 추가 핸들러
  const handleAdd = () => {
    if (!form.title || !startSlot || !form.end || isAdminView) return;
  
    const tagInfo = safeTagItems.find(
      item => item.tagType === selectedTagType && item.tagName === form.tag
    );
  
    const focusedBaseDate = new Date(currentWeek[focusedDayIndex]);
    
    const baseSchedule = {
      id: Date.now(),
      date: focusedBaseDate.toISOString().split("T")[0],
      start: startSlot,
      end: form.end,
      title: form.title,
      description: form.description || "",
      tag: form.tag,
      tagType: tagInfo ? tagInfo.tagType : "",
      done: false
    };
  
    const repeatCount = parseInt(form.repeatCount || "1");
    const interval = parseInt(form.interval || "1");
    const weekdays = form.weekdays.length > 0
      ? form.weekdays
      : [DAYS_OF_WEEK[focusedDayIndex]];
  
    const newSchedules = [];
  
    for (let i = 0; i < repeatCount; i++) {
      for (const weekday of weekdays) {
        const weekdayIndex = DAYS_OF_WEEK.indexOf(weekday);
        if (weekdayIndex === -1) continue;
  
        const offsetDays = (weekdayIndex - focusedDayIndex) + (i * 7 * interval);
        const repeatDate = new Date(focusedBaseDate);
        repeatDate.setDate(repeatDate.getDate() + offsetDays);
  
        const schedule = {
          ...baseSchedule,
          id: Date.now() + i * 10000 + weekdayIndex,
          date: repeatDate.toISOString().split("T")[0],
        };
  
        if (checkScheduleOverlap(safeSchedules, schedule)) {
          setShowOverlapMessage(true);
          setTimeout(() => setShowOverlapMessage(false), 3000);
          return;
        }
  
        newSchedules.push(schedule);
      }
    }
  
    if (handleSetSchedules && currentUser) {
      const updatedSchedules = [...safeSchedules, ...newSchedules];
      handleSetSchedules(updatedSchedules);
    }
  
    setStartSlot("07:00");
    setForm({
      title: "",
      end: "07:00",
      description: "",
      tag: "",
      repeatCount: "1",
      interval: "1",
      weekdays: [],
    });
    setSelectedTagType("");
    setActiveTimeSlot(null);
  };
  
  // 태그 추가 핸들러
  const handleAddTag = () => {
    if (!newTagType.trim() || !newTagName.trim() || isAdminView) return;
    
    let updatedTags = [...safeTags];
    if (!safeTags.find(t => t.tagType === newTagType)) {
      const newColor = assignNewTagColor(newTagType);
      updatedTags = [...safeTags, { tagType: newTagType, color: newColor }];
      if (handleSetTags) {
        handleSetTags(updatedTags);
      }
    }
    
    if (!safeTagItems.find(t => t.tagType === newTagType && t.tagName === newTagName)) {
      const updatedTagItems = [...safeTagItems, { tagType: newTagType, tagName: newTagName }];
      if (handleSetTagItems) {
        handleSetTagItems(updatedTagItems);
      }
    }
    
    setNewTagType(""); 
    setNewTagName("");
  };
  
  // 태그 삭제 핸들러
  const handleDeleteTagItem = (tagType, tagName) => {
    if (handleSetTagItems && currentUser && !isAdminView) {
      const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
      handleSetTagItems(updatedTagItems);
    }
  };

  // 태그 선택 핸들러
  const handleSelectTag = (tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm({ ...form, tag: tagName });
  };

  // 주간 네비게이션 핸들러들
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
  
  // 시간 슬롯 클릭 핸들러
  const handleTimeSlotClick = (time) => {
    if (isAdminView) return; // 관리자 모드에서는 비활성화
    
    setStartSlot(time);
    setActiveTimeSlot(time);
    
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + 60;
    const endTime = minutesToTimeString(endMinutes);
    setForm({ ...form, end: endTime });
  };
  
  // 요일 선택 핸들러
  const handleWeekdaySelect = (weekday) => {
    if (isAdminView) return; // 관리자 모드에서는 비활성화
    
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
      {/* 서버 기반 모드 알림 배너 */}
      <div className="bg-green-50 border-l-4 border-green-400 p-4 shadow-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-green-400 text-xl">🌐</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              {isAdminView ? '관리자 모드 (읽기 전용)' : '100% 서버 기반 모드'}
            </h3>
            <div className="mt-1 text-sm text-green-700">
              <p>
                <strong>{currentUser}님</strong>의 모든 데이터가 Supabase 서버에서 실시간으로 관리됩니다. 
                {isAdminView && <strong> 관리자는 읽기 전용으로 확인만 가능합니다.</strong>}
                {saving && <strong className="text-orange-600"> 💾 저장 중...</strong>}
                {` (마지막 동기화: ${lastRefresh.toLocaleTimeString('ko-KR')})`}
              </p>
            </div>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => handleDataRefresh()}
              disabled={loading || saving}
              className="text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
              title="서버 새로고침"
            >
              🔄
            </button>
          </div>
        </div>
      </div>

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
                  👑 {currentUser}님의 주간 캘린더 (읽기 전용)
                </h1>
                <p className="text-red-200 text-sm">관리자 모드 - 100% 서버 기반</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ServerDataRefresher 
                currentUser={currentUser}
                onDataRefresh={handleDataRefresh}
                isAdminView={isAdminView}
                lastSyncTime={lastRefresh}
              />
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

      {/* WeeklyCalendarUI 렌더링 */}
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

      {/* 서버 상태 플로팅 인디케이터 */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          서버에 저장 중...
        </div>
      )}

      {/* 관리자 플로팅 도구 */}
      {isAdminView && onBackToDashboard && (
        <div className="fixed bottom-6 left-6 flex flex-col space-y-2">
          <button
            onClick={onBackToDashboard}
            className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition duration-200"
            title="대시보드로 돌아가기"
          >
            <span className="text-lg">🏠</span>
          </button>
          <button
            onClick={() => {
              const totalSchedules = safeSchedules.length;
              const totalTags = safeTags.length;
              const totalTagItems = safeTagItems.length;
              
              alert(`📊 ${currentUser}님 캘린더 요약 (100% 서버 데이터)\n\n` +
                `• 총 일정: ${totalSchedules}개\n` +
                `• 태그 타입: ${totalTags}개\n` +
                `• 태그 아이템: ${totalTagItems}개\n\n` +
                `조회 시간: ${new Date().toLocaleString('ko-KR')}\n` +
                `데이터 소스: Supabase 서버 (실시간)\n` +
                `로컬 저장소: 사용 안함`
              );
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition duration-200"
            title="통계 보기"
          >
            <span className="text-lg">📊</span>
          </button>
          <button
            onClick={() => handleDataRefresh()}
            disabled={loading || saving}
            className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg transition duration-200 disabled:opacity-50"
            title="서버 데이터 새로고침"
          >
            <span className="text-lg">{loading ? '⏳' : '🔄'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default function SimplifiedWeeklyCalendar(props) {
  return <WeeklyCalendar {...props} />;
}
