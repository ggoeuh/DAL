import React from "react";
import { useWeeklyCalendarLogic } from "./WeeklyCalendarLogic";
import { WeeklyCalendarUI } from "./WeeklyCalendarUI";

const WeeklyCalendar = ({ 
  // 새로운 props 구조
  currentUser,
  onLogout,
  isServerBased = true,
  enableAutoRefresh = true,
  
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
  // 새로운 훅 사용 방식
  const calendarLogic = useWeeklyCalendarLogic({
    currentUser,
    isServerBased,
    enableAutoRefresh,
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
    lastSyncTime,
    
    // 상수들
    DAYS_OF_WEEK,
    
    // 헬퍼 함수들 (훅에서 제공)
    assignNewTagColor,
    handleDayFocus,
    checkScheduleOverlap,
    parseTimeToMinutes,
    minutesToTimeString,
    getDayOfWeek,
    pixelToNearestTimeSlot,
    
    // 서버 관리 함수들 (새로 추가된 것들)
    loadDataFromServer,
    saveDataToServer,
    addSchedule,
    updateSchedule,
    deleteSchedule
  } = calendarLogic;

  // 하위 호환성을 위한 레거시 상태 업데이트 (서버 기반이 아닐 때만)
  // useRef로 이전 값 추적하여 무한 렌더링 방지
  const prevSchedulesRef = React.useRef();
  const prevTagsRef = React.useRef();
  const prevTagItemsRef = React.useRef();

  React.useEffect(() => {
    if (!isServerBased && setSchedules && prevSchedulesRef.current !== safeSchedules) {
      prevSchedulesRef.current = safeSchedules;
      setSchedules(safeSchedules);
    }
  }, [safeSchedules, isServerBased, setSchedules]);

  React.useEffect(() => {
    if (!isServerBased && setTags && prevTagsRef.current !== safeTags) {
      prevTagsRef.current = safeTags;
      setTags(safeTags);
    }
  }, [safeTags, isServerBased, setTags]);

  React.useEffect(() => {
    if (!isServerBased && setTagItems && prevTagItemsRef.current !== safeTagItems) {
      prevTagItemsRef.current = safeTagItems;
      setTagItems(safeTagItems);
    }
  }, [safeTagItems, isServerBased, setTagItems]);

  // 컨텍스트 메뉴 핸들러들
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
  
  const handleDeleteSchedule = async () => {
    const scheduleToDelete = safeSchedules.find(s => s.id === contextMenu.scheduleId);
    
    if (scheduleToDelete) {
      // 새로운 훅의 deleteSchedule 함수 사용
      const result = await deleteSchedule(contextMenu.scheduleId);
      
      if (result.success) {
        console.log('일정 삭제됨:', scheduleToDelete.title);
      } else {
        console.error('일정 삭제 실패:', result.error);
        alert('일정 삭제에 실패했습니다: ' + result.error);
      }
    }
    
    setContextMenu({ ...contextMenu, visible: false });
  };

  // 복사 관련 핸들러들 - 수정됨
  const handleCopyMove = (e) => {
    if (!copyingSchedule) return;
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      const newIndex = (focusedDayIndex - 1 + 7) % 7;
      const targetDate = currentWeek[newIndex]; // ✅ Date 객체 가져오기
      handleDayFocus(targetDate); // ✅ Date 객체 전달
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const newIndex = (focusedDayIndex + 1) % 7;
      const targetDate = currentWeek[newIndex]; // ✅ Date 객체 가져오기
      handleDayFocus(targetDate); // ✅ Date 객체 전달
    }
  };

  const handleCopyEnd = async (e) => {
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
        // 새로운 훅의 addSchedule 함수 사용
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
  };

  // 드래그 관련 핸들러들 - 수정됨
  const handleDragStart = (e, scheduleId) => {
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
    if (!calendarLogic.dragging) return;
    e.preventDefault();
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      const newIndex = (focusedDayIndex - 1 + 7) % 7;
      const targetDate = currentWeek[newIndex]; // ✅ Date 객체 가져오기
      handleDayFocus(targetDate); // ✅ Date 객체 전달
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const newIndex = (focusedDayIndex + 1) % 7;
      const targetDate = currentWeek[newIndex]; // ✅ Date 객체 가져오기
      handleDayFocus(targetDate); // ✅ Date 객체 전달
    }
  };

  const handleDragEnd = async (e) => {
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
        // 새로운 훅의 updateSchedule 함수 사용
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
  };

  // 일정 추가 핸들러
  const handleAdd = async () => {
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
  };
  
  // 태그 추가 핸들러
  const handleAddTag = async () => {
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
          // 로컬 상태 업데이트는 훅 내부에서 처리됨
          console.log('태그 추가 완료:', newTagType, newTagName);
        } else {
          console.error('태그 추가 실패:', result.error);
          alert('태그 추가에 실패했습니다: ' + result.error);
          return;
        }
      } else if (!isServerBased) {
        // 레거시 모드에서는 직접 상태 업데이트
        if (setTags) setTags(updatedTags);
        if (setTagItems) setTagItems(updatedTagItems);
      }
    }
    
    setNewTagType(""); 
    setNewTagName("");
  };
  
  // 태그 삭제 핸들러
  const handleDeleteTagItem = async (tagType, tagName) => {
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
    } else if (!isServerBased && setTagItems) {
      setTagItems(updatedTagItems);
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
    setStartSlot(time);
    setActiveTimeSlot(time);
    
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + 60;
    const endTime = minutesToTimeString(endMinutes);
    setForm({ ...form, end: endTime });
  };
  
  // 요일 선택 핸들러 - 수정됨
  const handleWeekdaySelect = (weekday) => {
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

  // 수동 새로고침 핸들러
  const handleManualRefresh = async () => {
    if (isServerBased) {
      const result = await loadDataFromServer();
      if (result.success) {
        console.log('수동 새로고침 완료');
      } else {
        console.error('수동 새로고침 실패:', result.error);
        alert('데이터 새로고침에 실패했습니다: ' + result.error);
      }
    }
  };

  return (
    <WeeklyCalendarUI
      calendarLogic={calendarLogic}
      currentUser={currentUser}
      onLogout={onLogout}
      isServerBased={isServerBased}
      isLoading={isLoading}
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

export default function SimplifiedWeeklyCalendar(props) {
  return <WeeklyCalendar {...props} />;
}
