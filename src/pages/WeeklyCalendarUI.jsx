import React, { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useWeeklyCalendarLogic } from "./WeeklyCalendarLogic";
// ✅ 순환 import 제거 - WeeklyCalendarUI는 이 파일 하단에서 정의됨

// 날짜 유효성 검증 함수
const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
};

const WeeklyCalendar = ({ 
  // 새로운 props 구조
  currentUser,
  onLogout,
  isServerBased = true,
  enableAutoRefresh = false, // ✅ 기본값을 false로 변경
  
  // 레거시 props (하위 호환성을 위해 유지, 서버 모드가 아닐 때만 사용)
  schedules = [], 
  setSchedules, 
  tags = [], 
  setTags, 
  tagItems = [], 
  setTagItems,
  saveToServer,
  loadFromServer
}) => {
  // URL 파라미터에서 날짜 가져오기 및 검증
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  
  // ✅ 날짜 검증 및 안전한 처리 - useMemo로 최적화
  const initialDate = useMemo(() => {
    if (dateParam && isValidDate(dateParam)) {
      console.log('✅ 유효한 날짜 파라미터:', dateParam);
      return dateParam;
    }
    if (dateParam) {
      console.warn('⚠️ 잘못된 날짜 형식:', dateParam, '→ 오늘 날짜 사용');
    }
    return null;
  }, [dateParam]);

  // ✅ 캘린더 로직 훅 사용 - 안정적인 props 전달
  const calendarLogic = useWeeklyCalendarLogic({
    currentUser,
    isServerBased,
    enableAutoRefresh,
    initialDate,
    // 서버 기반이 아닐 때만 초기 데이터 전달
    initialSchedules: !isServerBased ? schedules : [],
    initialTags: !isServerBased ? tags : [],
    initialTagItems: !isServerBased ? tagItems : [],
    initialMonthlyGoals: []
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
    isLoading,
    isSaving, // ✅ 저장 상태 추가
    lastSyncTime,
    
    // 상수들
    DAYS_OF_WEEK,
    
    // 헬퍼 함수들
    assignNewTagColor,
    handleDayFocus,
    checkScheduleOverlap,
    parseTimeToMinutes,
    minutesToTimeString,
    getDayOfWeek,
    pixelToNearestTimeSlot,
    
    // 서버 관리 함수들
    loadDataFromServer,
    saveDataToServer,
    addSchedule,
    updateSchedule,
    deleteSchedule
  } = calendarLogic;

  // ✅ 하위 호환성을 위한 레거시 상태 업데이트 - React.memo와 useCallback으로 최적화
  const updateLegacySchedules = useCallback((newSchedules) => {
    if (!isServerBased && setSchedules && newSchedules !== schedules) {
      setSchedules(newSchedules);
    }
  }, [isServerBased, setSchedules, schedules]);

  const updateLegacyTags = useCallback((newTags) => {
    if (!isServerBased && setTags && newTags !== tags) {
      setTags(newTags);
    }
  }, [isServerBased, setTags, tags]);

  const updateLegacyTagItems = useCallback((newTagItems) => {
    if (!isServerBased && setTagItems && newTagItems !== tagItems) {
      setTagItems(newTagItems);
    }
  }, [isServerBased, setTagItems, tagItems]);

  // ✅ 레거시 상태 업데이트 - 의존성 최적화
  React.useEffect(() => {
    updateLegacySchedules(safeSchedules);
  }, [safeSchedules, updateLegacySchedules]);

  React.useEffect(() => {
    updateLegacyTags(safeTags);
  }, [safeTags, updateLegacyTags]);

  React.useEffect(() => {
    updateLegacyTagItems(safeTagItems);
  }, [safeTagItems, updateLegacyTagItems]);

  // ✅ 컨텍스트 메뉴 핸들러들 - useCallback으로 최적화
  const handleContextMenu = useCallback((e, scheduleId) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      scheduleId
    });
  }, [setContextMenu]);
  
  const handleCopySchedule = useCallback(() => {
    const scheduleToCopy = safeSchedules.find(s => s.id === contextMenu.scheduleId);
    if (scheduleToCopy) {
      setCopyingSchedule(scheduleToCopy);
      console.log('일정 복사됨:', scheduleToCopy.title);
    }
    setContextMenu({ ...contextMenu, visible: false });
  }, [safeSchedules, contextMenu, setCopyingSchedule, setContextMenu]);
  
  const handleDeleteSchedule = useCallback(async () => {
    const scheduleToDelete = safeSchedules.find(s => s.id === contextMenu.scheduleId);
    
    if (scheduleToDelete) {
      const result = await deleteSchedule(contextMenu.scheduleId);
      
      if (result.success) {
        console.log('일정 삭제됨:', scheduleToDelete.title);
      } else {
        console.error('일정 삭제 실패:', result.error);
        alert('일정 삭제에 실패했습니다: ' + result.error);
      }
    }
    
    setContextMenu({ ...contextMenu, visible: false });
  }, [safeSchedules, contextMenu, deleteSchedule, setContextMenu]);

  // ✅ 복사 관련 핸들러들 - useCallback으로 최적화
  const handleCopyMove = useCallback((e) => {
    if (!copyingSchedule) return;
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      const newIndex = (focusedDayIndex - 1 + 7) % 7;
      const targetDate = currentWeek[newIndex];
      handleDayFocus(targetDate);
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const newIndex = (focusedDayIndex + 1) % 7;
      const targetDate = currentWeek[newIndex];
      handleDayFocus(targetDate);
    }
  }, [copyingSchedule, focusedDayIndex, currentWeek, handleDayFocus]);

  const handleCopyEnd = useCallback(async (e) => {
    if (!copyingSchedule) return;
    
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
        const result = await addSchedule(newSchedule);
        
        if (result.success) {
          console.log(`일정 붙여넣기 완료: ${copyingSchedule.title} -> ${getDayOfWeek(currentWeek[targetDayIndex])} ${dropTimeSlot}-${newEnd}`);
        } else {
          console.error('일정 붙여넣기 실패:', result.error);
          alert('일정 붙여넣기에 실패했습니다: ' + result.error);
        }
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
      }
    }
    
    setCopyingSchedule(null);
  }, [copyingSchedule, currentWeek, pixelToNearestTimeSlot, parseTimeToMinutes, minutesToTimeString, checkScheduleOverlap, safeSchedules, addSchedule, getDayOfWeek, setShowOverlapMessage, setCopyingSchedule]);

  // ✅ 드래그 관련 핸들러들 - useCallback으로 최적화
  const handleDragStart = useCallback((e, scheduleId) => {
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
  }, [safeSchedules, setDragging, setDragOffset]);

  const handleDragMove = useCallback((e) => {
    if (!calendarLogic.dragging) return;
    e.preventDefault();
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      const newIndex = (focusedDayIndex - 1 + 7) % 7;
      const targetDate = currentWeek[newIndex];
      handleDayFocus(targetDate);
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const newIndex = (focusedDayIndex + 1) % 7;
      const targetDate = currentWeek[newIndex];
      handleDayFocus(targetDate);
    }
  }, [calendarLogic.dragging, focusedDayIndex, currentWeek, handleDayFocus]);

  const handleDragEnd = useCallback(async (e) => {
    if (!calendarLogic.dragging) {
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
      
      const updatedData = {
        date: newDate,
        start: newStartTime,
        end: newEndTime
      };
      
      const updatedSchedule = { ...schedule, ...updatedData };
      
      if (!checkScheduleOverlap(safeSchedules, updatedSchedule)) {
        const result = await updateSchedule(calendarLogic.dragging, updatedData);
        
        if (result.success) {
          console.log(`일정 이동 완료: ${schedule.title}`);
        } else {
          console.error('일정 이동 실패:', result.error);
          alert('일정 이동에 실패했습니다: ' + result.error);
        }
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
      }
    }
    
    setDragging(null);
  }, [calendarLogic.dragging, calendarLogic.dragOffset, safeSchedules, currentWeek, pixelToNearestTimeSlot, parseTimeToMinutes, minutesToTimeString, checkScheduleOverlap, updateSchedule, setShowOverlapMessage, setDragging]);

  // ✅ 일정 추가 핸들러 - useCallback으로 최적화
  const handleAdd = useCallback(async () => {
    if (!form.title || !startSlot || !form.end) return;
  
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
  
    // 모든 일정을 순차적으로 추가
    let allSuccess = true;
    for (const schedule of newSchedules) {
      const result = await addSchedule(schedule);
      if (!result.success) {
        console.error('일정 추가 실패:', result.error);
        alert('일정 추가에 실패했습니다: ' + result.error);
        allSuccess = false;
        break;
      }
    }
  
    if (allSuccess) {
      // 폼 초기화
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
    }
  }, [form, startSlot, safeTagItems, selectedTagType, currentWeek, focusedDayIndex, DAYS_OF_WEEK, checkScheduleOverlap, safeSchedules, addSchedule, setShowOverlapMessage, setStartSlot, setForm, setSelectedTagType, setActiveTimeSlot]);
  
  // ✅ 태그 추가 핸들러 - useCallback으로 최적화
  const handleAddTag = useCallback(async () => {
    if (!newTagType.trim() || !newTagName.trim()) return;
    
    // 태그 타입이 없으면 추가
    let updatedTags = [...safeTags];
    if (!safeTags.find(t => t.tagType === newTagType)) {
      const newColor = assignNewTagColor(newTagType);
      updatedTags = [...safeTags, { tagType: newTagType, color: newColor }];
    }
    
    // 태그 아이템이 없으면 추가
    if (!safeTagItems.find(t => t.tagType === newTagType && t.tagName === newTagName)) {
      const updatedTagItems = [...safeTagItems, { tagType: newTagType, tagName: newTagName }];
      
      // 서버에 저장
      if (isServerBased && currentUser) {
        const result = await saveDataToServer({
          schedules: safeSchedules,
          tags: updatedTags,
          tagItems: updatedTagItems,
          monthlyGoals: calendarLogic.safeMonthlyGoals
        });
        
        if (result.success) {
          console.log('태그 추가 완료:', newTagType, newTagName);
        } else {
          console.error('태그 추가 실패:', result.error);
          alert('태그 추가에 실패했습니다: ' + result.error);
          return;
        }
      } else if (!isServerBased) {
        // 레거시 모드에서는 직접 상태 업데이트
        updateLegacyTags(updatedTags);
        updateLegacyTagItems(updatedTagItems);
      }
    }
    
    setNewTagType(""); 
    setNewTagName("");
  }, [newTagType, newTagName, safeTags, safeTagItems, assignNewTagColor, isServerBased, currentUser, saveDataToServer, safeSchedules, calendarLogic.safeMonthlyGoals, updateLegacyTags, updateLegacyTagItems, setNewTagType, setNewTagName]);
  
  // ✅ 태그 삭제 핸들러 - useCallback으로 최적화
  const handleDeleteTagItem = useCallback(async (tagType, tagName) => {
    const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
    
    if (isServerBased && currentUser) {
      const result = await saveDataToServer({
        schedules: safeSchedules,
        tags: safeTags,
        tagItems: updatedTagItems,
        monthlyGoals: calendarLogic.safeMonthlyGoals
      });
      
      if (result.success) {
        console.log('태그 삭제 완료:', tagType, tagName);
      } else {
        console.error('태그 삭제 실패:', result.error);
        alert('태그 삭제에 실패했습니다: ' + result.error);
      }
    } else if (!isServerBased) {
      updateLegacyTagItems(updatedTagItems);
    }
  }, [safeTagItems, isServerBased, currentUser, saveDataToServer, safeSchedules, safeTags, calendarLogic.safeMonthlyGoals, updateLegacyTagItems]);

  // ✅ 태그 선택 핸들러 - useCallback으로 최적화
  const handleSelectTag = useCallback((tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm({ ...form, tag: tagName });
  }, [form, setSelectedTagType, setForm]);

  // ✅ 주간 네비게이션 핸들러들 - useCallback으로 최적화
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeek(prevWeek => {
      return prevWeek.map(date => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() - 7);
        return newDate;
      });
    });
  }, [setCurrentWeek]);

  const goToNextWeek = useCallback(() => {
    setCurrentWeek(prevWeek => {
      return prevWeek.map(date => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + 7);
        return newDate;
      });
    });
  }, [setCurrentWeek]);

  const goToCurrentWeek = useCallback(() => {
    const currentDate = new Date();
    setCurrentWeek(
      Array(7).fill().map((_, i) => {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() - currentDate.getDay() + i);
        return date;
      })
    );
    setFocusedDayIndex(2);
    
    const newVisibleDays = [];
    for (let i = -2; i <= 2; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      newVisibleDays.push(date);
    }
    setVisibleDays(newVisibleDays);
  }, [setCurrentWeek, setFocusedDayIndex, setVisibleDays]);
  
  // ✅ 시간 슬롯 클릭 핸들러 - useCallback으로 최적화
  const handleTimeSlotClick = useCallback((time) => {
    console.log('🕐 시간 슬롯 클릭 처리:', time); // 디버깅용
    
    setStartSlot(time);
    setActiveTimeSlot(time);
    
    // 끝 시간을 1시간 후로 자동 설정
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + 60;
    const endTime = minutesToTimeString(endMinutes);
    
    setForm({ ...form, end: endTime });
    
    console.log('✅ 시간 설정 완료:', { start: time, end: endTime }); // 디버깅용
  }, [form, setStartSlot, setActiveTimeSlot, setForm, parseTimeToMinutes, minutesToTimeString]);
  
  // ✅ 요일 선택 핸들러 - useCallback으로 최적화
  const handleWeekdaySelect = useCallback((weekday) => {
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
  }, [form, setForm]);

  // ✅ 수동 새로고침 핸들러 - useCallback으로 최적화
  const handleManualRefresh = useCallback(async () => {
    if (isServerBased) {
      const result = await loadDataFromServer(true); // 강제 새로고침
      if (result.success) {
        console.log('수동 새로고침 완료');
      } else {
        console.error('수동 새로고침 실패:', result.error);
        alert('데이터 새로고침에 실패했습니다: ' + result.error);
      }
    }
  }, [isServerBased, loadDataFromServer]);

  // ✅ WeeklyCalendarUI 컴포넌트를 직접 반환 (import 문제 해결)
  return (
    <WeeklyCalendarUI
      calendarLogic={calendarLogic}
      currentUser={currentUser}
      onLogout={onLogout}
      isServerBased={isServerBased}
      isLoading={isLoading}
      isSaving={isSaving}
      lastSyncTime={lastSyncTime}
      onManualRefresh={handleManualRefresh}
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
    />
  );
};

// ✅ WeeklyCalendarUI 컴포넌트 정의 (앞서 만든 최적화된 버전을 여기에 포함)
// 이 부분은 별도 파일(WeeklyCalendarUI.jsx)에서 import하거나, 
// 아니면 여기서 직접 정의해야 합니다.

// ✅ React.memo로 컴포넌트 최적화
const OptimizedWeeklyCalendar = React.memo(WeeklyCalendar);

export default function SimplifiedWeeklyCalendar(props) {
  return <OptimizedWeeklyCalendar {...props} />;
}
