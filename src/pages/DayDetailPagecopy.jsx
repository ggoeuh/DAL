// WeeklyCalendar.jsx - 드래그 앤 드롭 완전히 수정된 버전

import React, { useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useParams, useLocation } from "react-router-dom";
import { useWeeklyCalendarLogic } from "./WeeklyCalendarLogic";
import { WeeklyCalendarUI } from "./WeeklyCalendarUI";

// 날짜 유효성 검증 함수
const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
};

const WeeklyCalendar = ({ 
  currentUser,
  onLogout,
  isServerBased = true,
  enableAutoRefresh = false,
  schedules = [], 
  setSchedules, 
  tags = [], 
  setTags, 
  tagItems = [], 
  setTagItems,
  saveToServer,
  loadFromServer
}) => {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  
  const initialDate = useMemo(() => {
    const queryDate = searchParams.get('date');
    if (queryDate && isValidDate(queryDate)) {
      return queryDate;
    }
    
    const pathDate = params.date;
    if (pathDate && isValidDate(pathDate)) {
      return pathDate;
    }
    
    const pathMatch = location.pathname.match(/\/day\/(\d{4}-\d{2}-\d{2})/);
    if (pathMatch && pathMatch[1] && isValidDate(pathMatch[1])) {
      return pathMatch[1];
    }
    
    return null;
  }, [searchParams, params, location]);

  const calendarLogic = useWeeklyCalendarLogic({
    currentUser,
    isServerBased,
    enableAutoRefresh,
    initialDate,
    initialSchedules: !isServerBased ? schedules : [],
    initialTags: !isServerBased ? tags : [],
    initialTagItems: !isServerBased ? tagItems : [],
    initialMonthlyGoals: []
  });

  const {
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
    isSaving,
    lastSyncTime,
    DAYS_OF_WEEK,
    assignNewTagColor,
    handleDayFocus,
    checkScheduleOverlap,
    parseTimeToMinutes,
    minutesToTimeString,
    getDayOfWeek,
    pixelToNearestTimeSlot,
    getDayIndexFromKoreanDay,
    loadDataFromServer,
    saveDataToServer,
    addSchedule,
    updateSchedule,
    deleteSchedule
  } = calendarLogic;

  // 레거시 상태 업데이트
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

  React.useEffect(() => {
    updateLegacySchedules(safeSchedules);
  }, [safeSchedules, updateLegacySchedules]);

  React.useEffect(() => {
    updateLegacyTags(safeTags);
  }, [safeTags, updateLegacyTags]);

  React.useEffect(() => {
    updateLegacyTagItems(safeTagItems);
  }, [safeTagItems, updateLegacyTagItems]);

  // 컨텍스트 메뉴 핸들러들
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
      document.body.style.cursor = 'copy';
      
      const message = document.createElement('div');
      message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      message.textContent = `"${scheduleToCopy.title}" 복사됨 - 원하는 위치에 붙여넣기하세요`;
      document.body.appendChild(message);
      
      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
      }, 3000);
    }
    setContextMenu({ ...contextMenu, visible: false });
  }, [safeSchedules, contextMenu, setCopyingSchedule, setContextMenu]);
  
  const handleDeleteSchedule = useCallback(async () => {
    const scheduleToDelete = safeSchedules.find(s => s.id === contextMenu.scheduleId);
    
    if (scheduleToDelete) {
      if (window.confirm(`"${scheduleToDelete.title}" 일정을 삭제하시겠습니까?`)) {
        const result = await deleteSchedule(contextMenu.scheduleId);
        
        if (result.success) {
          console.log('🗑️ 일정 삭제됨:', scheduleToDelete.title);
        } else {
          console.error('❌ 일정 삭제 실패:', result.error);
          alert('일정 삭제에 실패했습니다: ' + result.error);
        }
      }
    }
    
    setContextMenu({ ...contextMenu, visible: false });
  }, [safeSchedules, contextMenu, deleteSchedule, setContextMenu]);

  // 복사 관련 핸들러들
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
    
    document.body.style.cursor = 'default';
    
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
          const message = document.createElement('div');
          message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          `;
          message.textContent = `일정 붙여넣기 완료: ${copyingSchedule.title}`;
          document.body.appendChild(message);
          
          setTimeout(() => {
            if (document.body.contains(message)) {
              document.body.removeChild(message);
            }
          }, 2000);
        } else {
          alert('일정 붙여넣기에 실패했습니다: ' + result.error);
        }
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
      }
    }
    
    setCopyingSchedule(null);
  }, [copyingSchedule, currentWeek, pixelToNearestTimeSlot, parseTimeToMinutes, minutesToTimeString, checkScheduleOverlap, safeSchedules, addSchedule, setShowOverlapMessage, setCopyingSchedule]);

  // 🔧 수정된 드래그 핸들러들 - 실시간 시각적 피드백 추가
  const handleDragStart = useCallback((e, scheduleId) => {
    console.log('🖱️ 드래그 시작:', scheduleId);
    
    const schedule = safeSchedules.find(s => s.id === scheduleId);
    if (!schedule) {
      console.error('❌ 스케줄을 찾을 수 없음:', scheduleId);
      return;
    }
    
    // 드래그 상태 설정
    setDragging(scheduleId);
    
    // 드래그 오프셋 계산
    const rect = e.currentTarget.getBoundingClientRect();
    const dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setDragOffset(dragOffset);
    
    // 🔧 드래그 중 시각적 피드백을 위한 가상 엘리먼트 생성
    const dragGhost = document.createElement('div');
    dragGhost.id = 'drag-ghost';
    dragGhost.style.cssText = `
      position: fixed;
      left: ${e.clientX - dragOffset.x}px;
      top: ${e.clientY - dragOffset.y}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      z-index: 9999;
      pointer-events: none;
      background: rgba(59, 130, 246, 0.8);
      color: white;
      padding: 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transform: scale(1.05);
      border: 2px solid #3b82f6;
    `;
    dragGhost.textContent = `📦 ${schedule.title} (${schedule.start}-${schedule.end})`;
    document.body.appendChild(dragGhost);
    
    // 커서 변경
    document.body.style.cursor = 'grabbing';
    
    console.log('✅ 드래그 시작 완료');
  }, [safeSchedules, setDragging, setDragOffset]);

  const handleDragMove = useCallback((e) => {
    if (!calendarLogic.dragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // 🔧 드래그 고스트 실시간 업데이트
    const dragGhost = document.getElementById('drag-ghost');
    if (dragGhost && calendarLogic.dragOffset) {
      dragGhost.style.left = `${e.clientX - calendarLogic.dragOffset.x}px`;
      dragGhost.style.top = `${e.clientY - calendarLogic.dragOffset.y}px`;
    }
    
    // 화면 가장자리에서 주간 이동
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
  }, [calendarLogic.dragging, calendarLogic.dragOffset, focusedDayIndex, currentWeek, handleDayFocus]);

  const handleDragEnd = useCallback(async (e) => {
    console.log('🖱️ 드래그 종료 시작');
    
    // 🔧 드래그 고스트 제거
    const dragGhost = document.getElementById('drag-ghost');
    if (dragGhost) {
      document.body.removeChild(dragGhost);
    }
    
    // 커서 복원
    document.body.style.cursor = 'default';
    
    if (!calendarLogic.dragging) {
      setDragging(null);
      return;
    }
    
    // 드래그 중인 일정 찾기
    const schedule = safeSchedules.find(s => s.id === calendarLogic.dragging);
    if (!schedule) {
      console.error('❌ 드래그 중인 스케줄을 찾을 수 없음');
      setDragging(null);
      return;
    }
    
    // 🔧 개선된 드롭 위치 계산 - visibleDays 기준으로 정확한 매핑
    const containers = document.querySelectorAll('[data-day-index]');
    let targetDayIndex = null;
    let targetContainer = null;
    let relativeY = null;
    
    console.log('🎯 드롭 위치 감지 시작:', {
      mouseX: e.clientX,
      mouseY: e.clientY,
      containerCount: containers.length
    });
    
    // 🔧 정확한 X 좌표 기반 컨테이너 찾기
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      const dayIndex = parseInt(container.dataset.dayIndex);
      
      console.log(`📍 컨테이너 ${dayIndex} 검사:`, {
        rect: { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom) },
        mouse: { x: e.clientX, y: e.clientY },
        inXRange: e.clientX >= rect.left && e.clientX <= rect.right,
        inYRange: e.clientY >= rect.top && e.clientY <= rect.bottom
      });
      
      // X 좌표만으로 컨테이너 결정 (Y는 나중에 시간 계산용)
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        targetDayIndex = dayIndex;
        targetContainer = container;
        
        // 🔧 정확한 Y 위치 계산 - 컨테이너 내부의 상대적 위치
        relativeY = Math.max(0, e.clientY - rect.top);
        
        console.log('✅ 타겟 컨테이너 확정:', {
          targetDayIndex,
          relativeY,
          containerRect: rect
        });
        break;
      }
    }
    
    // 🔧 타겟을 찾지 못한 경우의 처리 개선
    if (targetDayIndex === null || targetContainer === null) {
      console.log('⚠️ 드롭 타겟을 찾지 못함 - 원본 위치 유지');
      setDragging(null);
      return;
    }
    
    // 🔧 visibleDays를 currentWeek의 인덱스로 매핑
    // visibleDays[targetDayIndex]를 currentWeek에서 찾기
    const targetVisibleDate = visibleDays[targetDayIndex];
    let actualWeekIndex = -1;
    
    for (let i = 0; i < currentWeek.length; i++) {
      if (currentWeek[i].toDateString() === targetVisibleDate.toDateString()) {
        actualWeekIndex = i;
        break;
      }
    }
    
    if (actualWeekIndex === -1) {
      console.error('❌ visibleDays와 currentWeek 매핑 실패');
      setDragging(null);
      return;
    }
    
    const newDate = currentWeek[actualWeekIndex].toISOString().split("T")[0];
    
    console.log('🗓️ 날짜 매핑 결과:', {
      targetDayIndex,
      targetVisibleDate: targetVisibleDate.toDateString(),
      actualWeekIndex,
      newDate
    });
    
    // 🔧 정확한 Y 좌표 → 시간 변환
    // 스크롤 위치를 고려한 절대 Y 위치 계산
    const scrollContainer = document.querySelector('.overflow-y-auto');
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    
    // 드래그 오프셋을 고려한 정확한 Y 위치
    const dragOffsetY = calendarLogic.dragOffset ? calendarLogic.dragOffset.y : 0;
    const adjustedY = relativeY + dragOffsetY; // 드래그 시작점을 고려
    const absoluteY = adjustedY + scrollTop;
    
    console.log('📐 Y 좌표 → 시간 변환:', {
      relativeY,
      dragOffsetY,
      adjustedY,
      scrollTop,
      absoluteY
    });
    
    // 새로운 시간 계산
    const newStartTime = pixelToNearestTimeSlot(absoluteY);
    
    // 기존 일정의 지속 시간 유지
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
    
    console.log('📅 일정 이동 상세 계산:', {
      원본: { 
        date: schedule.date, 
        start: schedule.start, 
        end: schedule.end,
        startPixel: parseTimeToMinutes(schedule.start) / 30 * 24
      },
      드래그정보: {
        relativeY,
        dragOffsetY,
        adjustedY,
        absoluteY
      },
      새위치: { 
        date: newDate, 
        start: newStartTime, 
        end: newEndTime,
        newPixel: parseTimeToMinutes(newStartTime) / 30 * 24
      },
      이동거리: {
        픽셀: absoluteY - (parseTimeToMinutes(schedule.start) / 30 * 24),
        시간: `${parseTimeToMinutes(newStartTime) - parseTimeToMinutes(schedule.start)}분`
      }
    });
    
    // 겹침 검사 (자기 자신 제외)
    const otherSchedules = safeSchedules.filter(s => s.id !== schedule.id);
    const conflictSchedule = otherSchedules.find(s => {
      if (s.date !== newDate) return false;
      
      const sStart = parseTimeToMinutes(s.start);
      const sEnd = parseTimeToMinutes(s.end);
      const newStart = parseTimeToMinutes(newStartTime);
      const newEnd = parseTimeToMinutes(newEndTime);
      
      return (
        (newStart >= sStart && newStart < sEnd) ||
        (newEnd > sStart && newEnd <= sEnd) ||
        (newStart <= sStart && newEnd >= sEnd)
      );
    });
    
    if (!conflictSchedule) {
      const result = await updateSchedule(calendarLogic.dragging, updatedData);
      
      if (result.success) {
        console.log(`✅ 일정 이동 완료: ${schedule.title}`);
        
        // 성공 피드백
        const message = document.createElement('div');
        message.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        if (schedule.date === newDate) {
          message.textContent = `시간 변경: ${schedule.title} (${newStartTime}-${newEndTime})`;
        } else {
          message.textContent = `일정 이동: ${schedule.title} → ${getDayOfWeek(currentWeek[actualWeekIndex])}`;
        }
        
        document.body.appendChild(message);
        
        setTimeout(() => {
          if (document.body.contains(message)) {
            document.body.removeChild(message);
          }
        }, 2000);
      } else {
        console.error('❌ 일정 이동 실패:', result.error);
        alert('일정 이동에 실패했습니다: ' + result.error);
      }
    } else {
      console.warn('⚠️ 일정 겹침 감지:', conflictSchedule.title);
      
      const message = document.createElement('div');
      message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      message.textContent = `일정 겹침: "${conflictSchedule.title}" (${conflictSchedule.start}-${conflictSchedule.end})`;
      document.body.appendChild(message);
      
      setTimeout(() => {
        if (document.body.contains(message)) {
          document.body.removeChild(message);
        }
      }, 3000);
    }
    
    // 드래그 상태 초기화
    setDragging(null);
    console.log('🏁 드래그 종료 완료');
  }, [calendarLogic.dragging, calendarLogic.dragOffset, safeSchedules, currentWeek, visibleDays, pixelToNearestTimeSlot, parseTimeToMinutes, minutesToTimeString, updateSchedule, setDragging, getDayOfWeek]);

  // 나머지 핸들러들 (일정 추가, 태그 관리 등)은 기존과 동일하게 유지
  const handleAdd = useCallback(async () => {
    if (!form.title || !startSlot || !form.end) {
      alert('제목, 시작 시간, 종료 시간을 모두 입력해주세요.');
      return;
    }
  
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
    
    const selectedWeekdays = form.weekdays && form.weekdays.length > 0
      ? form.weekdays
      : [DAYS_OF_WEEK[focusedDayIndex]];
  
    const newSchedules = [];
  
    for (let week = 0; week < repeatCount; week++) {
      for (const koreanWeekday of selectedWeekdays) {
        const weekdayIndex = getDayIndexFromKoreanDay(koreanWeekday);
        if (weekdayIndex === -1) continue;
  
        const currentWeekDate = currentWeek[weekdayIndex];
        const targetDate = new Date(currentWeekDate);
        targetDate.setDate(currentWeekDate.getDate() + (week * 7 * interval));
  
        const schedule = {
          ...baseSchedule,
          id: Date.now() + week * 10000 + weekdayIndex * 100 + Math.random() * 100,
          date: targetDate.toISOString().split("T")[0],
        };
  
        if (checkScheduleOverlap(safeSchedules, schedule)) {
          alert(`${targetDate.toLocaleDateString()} ${koreanWeekday}에 시간 겹침이 발생하여 일정 추가를 중단합니다.`);
          return;
        }
  
        newSchedules.push(schedule);
      }
    }
  
    let addedCount = 0;
    for (const schedule of newSchedules) {
      const result = await addSchedule(schedule);
      if (result.success) {
        addedCount++;
      } else {
        alert(`일정 추가에 실패했습니다: ${result.error}`);
        return;
      }
    }
  
    // 폼 초기화
    setStartSlot("07:00");
    setForm({
      title: "",
      end: "08:00",
      description: "",
      tag: "",
      repeatCount: "1",
      interval: "1",
      weekdays: [],
    });
    setSelectedTagType("");
    setActiveTimeSlot(null);
  }, [form, startSlot, safeTagItems, selectedTagType, currentWeek, focusedDayIndex, DAYS_OF_WEEK, checkScheduleOverlap, safeSchedules, addSchedule, getDayIndexFromKoreanDay, setStartSlot, setForm, setSelectedTagType, setActiveTimeSlot]);
  
  const handleAddTag = useCallback(async () => {
    if (!newTagType.trim() || !newTagName.trim()) {
      alert('태그 타입과 태그 이름을 모두 입력해주세요.');
      return;
    }
    
    try {
      let updatedTags = [...safeTags];
      if (!safeTags.find(t => t.tagType === newTagType)) {
        const newColor = assignNewTagColor(newTagType);
        updatedTags = [...safeTags, { tagType: newTagType, color: newColor }];
      }
      
      if (safeTagItems.find(t => t.tagType === newTagType && t.tagName === newTagName)) {
        alert('이미 존재하는 태그입니다.');
        return;
      }
      
      const updatedTagItems = [...safeTagItems, { tagType: newTagType, tagName: newTagName }];
      
      if (isServerBased && currentUser) {
        const result = await saveDataToServer({
          schedules: safeSchedules,
          tags: updatedTags,
          tagItems: updatedTagItems,
          monthlyGoals: calendarLogic.safeMonthlyGoals || []
        });
        
        if (result.success) {
          await loadDataFromServer(true);
          
          const message = document.createElement('div');
          message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          `;
          message.textContent = `태그 추가 완료: ${newTagType} - ${newTagName}`;
          document.body.appendChild(message);
          
          setTimeout(() => {
            if (document.body.contains(message)) {
              document.body.removeChild(message);
            }
          }, 2000);
        } else {
          alert('태그 추가에 실패했습니다: ' + result.error);
          return;
        }
      } else if (!isServerBased) {
        updateLegacyTags(updatedTags);
        updateLegacyTagItems(updatedTagItems);
      }
      
      setNewTagType(""); 
      setNewTagName("");
      
    } catch (error) {
      console.error('❌ 태그 추가 중 오류:', error);
      alert('태그 추가 중 오류가 발생했습니다.');
    }
  }, [newTagType, newTagName, safeTags, safeTagItems, assignNewTagColor, isServerBased, currentUser, saveDataToServer, safeSchedules, calendarLogic.safeMonthlyGoals, updateLegacyTags, updateLegacyTagItems, setNewTagType, setNewTagName, loadDataFromServer]);
  
  const handleDeleteTagItem = useCallback(async (tagType, tagName) => {
    if (!window.confirm(`"${tagType} - ${tagName}" 태그를 삭제하시겠습니까?`)) {
      return;
    }
    
    const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
    
    if (isServerBased && currentUser) {
      const result = await saveDataToServer({
        schedules: safeSchedules,
        tags: safeTags,
        tagItems: updatedTagItems,
        monthlyGoals: calendarLogic.safeMonthlyGoals || []
      });
      
      if (result.success) {
        await loadDataFromServer(true);
      } else {
        alert('태그 삭제에 실패했습니다: ' + result.error);
      }
    } else if (!isServerBased) {
      updateLegacyTagItems(updatedTagItems);
    }
  }, [safeTagItems, isServerBased, currentUser, saveDataToServer, safeSchedules, safeTags, calendarLogic.safeMonthlyGoals, updateLegacyTagItems, loadDataFromServer]);

  const handleSelectTag = useCallback((tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm({ ...form, tag: tagName });
  }, [form, setSelectedTagType, setForm]);

  // 주간 네비게이션
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeek(prevWeek => {
      const newWeek = prevWeek.map(date => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() - 7);
        return newDate;
      });
      
      const newVisibleDays = [];
      const centerDate = newWeek[focusedDayIndex];
      for (let i = -2; i <= 2; i++) {
        const date = new Date(centerDate);
        date.setDate(centerDate.getDate() + i);
        newVisibleDays.push(date);
      }
      setVisibleDays(newVisibleDays);
      
      return newWeek;
    });
  }, [focusedDayIndex, setCurrentWeek, setVisibleDays]);
  
  const goToNextWeek = useCallback(() => {
    setCurrentWeek(prevWeek => {
      const newWeek = prevWeek.map(date => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() + 7);
        return newDate;
      });
      
      const newVisibleDays = [];
      const centerDate = newWeek[focusedDayIndex];
      for (let i = -2; i <= 2; i++) {
        const date = new Date(centerDate);
        date.setDate(centerDate.getDate() + i);
        newVisibleDays.push(date);
      }
      setVisibleDays(newVisibleDays);
      
      return newWeek;
    });
  }, [focusedDayIndex, setCurrentWeek, setVisibleDays]);
  
  const goToCurrentWeek = useCallback(() => {
    const currentDate = new Date();
    
    const newCurrentWeek = Array(7).fill().map((_, i) => {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() - currentDate.getDay() + i);
      return date;
    });
    setCurrentWeek(newCurrentWeek);
    
    setFocusedDayIndex(currentDate.getDay());
    
    const newVisibleDays = [];
    for (let i = -2; i <= 2; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      newVisibleDays.push(date);
    }
    setVisibleDays(newVisibleDays);
  }, [setCurrentWeek, setFocusedDayIndex, setVisibleDays]);
  
  // 시간 슬롯 클릭 핸들러
  const handleTimeSlotClick = useCallback((time) => {
    setStartSlot(time);
    setActiveTimeSlot(time);
    
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + 60; // 기본 1시간
    const endTime = minutesToTimeString(endMinutes);
    setForm({ ...form, end: endTime });
  }, [form, setStartSlot, setActiveTimeSlot, setForm, parseTimeToMinutes, minutesToTimeString]);
  
  // 요일 선택 핸들러
  const handleWeekdaySelect = useCallback((weekday) => {
    const currentWeekdays = [...(form.weekdays || [])];
    
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

  // 반복 간격 설정 핸들러
  const handleIntervalChange = useCallback((interval) => {
    setForm({
      ...form,
      interval: interval.toString()
    });
  }, [form, setForm]);

  // 반복 횟수 설정 핸들러
  const handleRepeatCountChange = useCallback((count) => {
    setForm({
      ...form,
      repeatCount: count.toString()
    });
  }, [form, setForm]);

  // 수동 새로고침 핸들러
  const handleManualRefresh = useCallback(async () => {
    if (isServerBased) {
      const result = await loadDataFromServer(true);
      if (result.success) {
        const message = document.createElement('div');
        message.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #3b82f6;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        message.textContent = '데이터 새로고침 완료';
        document.body.appendChild(message);
        
        setTimeout(() => {
          if (document.body.contains(message)) {
            document.body.removeChild(message);
          }
        }, 2000);
      } else {
        alert('데이터 새로고침에 실패했습니다: ' + result.error);
      }
    }
  }, [isServerBased, loadDataFromServer]);

  // ESC 키로 복사/드래그 모드 취소
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        if (copyingSchedule) {
          setCopyingSchedule(null);
          document.body.style.cursor = 'default';
        }
        
        if (calendarLogic.dragging) {
          // 드래그 고스트 제거
          const dragGhost = document.getElementById('drag-ghost');
          if (dragGhost) {
            document.body.removeChild(dragGhost);
          }
          setDragging(null);
          document.body.style.cursor = 'default';
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [copyingSchedule, calendarLogic.dragging, setCopyingSchedule, setDragging]);

  // 전역 클릭 이벤트 (컨텍스트 메뉴 닫기)
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenu, setContextMenu]);

  // UI 컴포넌트에 전달할 props
  const uiProps = useMemo(() => ({
    calendarLogic,
    currentUser,
    onLogout,
    isServerBased,
    isLoading,
    isSaving,
    lastSyncTime,
    onManualRefresh: handleManualRefresh,
    
    // 이벤트 핸들러들
    handleContextMenu,
    handleCopySchedule,
    handleDeleteSchedule,
    handleCopyMove,
    handleCopyEnd,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleAdd,
    handleAddTag,
    handleDeleteTagItem,
    handleSelectTag,
    
    // 네비게이션
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    
    // 시간 및 요일 선택
    handleTimeSlotClick,
    handleWeekdaySelect,
    handleIntervalChange,
    handleRepeatCountChange,
    
    // 상태 정보
    currentWeek,
    focusedDayIndex,
    form,
    setForm,
    startSlot,
    selectedTagType,
    newTagType,
    setNewTagType,
    newTagName,
    setNewTagName,
    contextMenu,
    copyingSchedule,
    showOverlapMessage,
    
    // 데이터
    safeSchedules,
    safeTags,
    safeTagItems,
    
    // 상수
    DAYS_OF_WEEK
  }), [
    calendarLogic,
    currentUser,
    onLogout,
    isServerBased,
    isLoading,
    isSaving,
    lastSyncTime,
    handleManualRefresh,
    handleContextMenu,
    handleCopySchedule,
    handleDeleteSchedule,
    handleCopyMove,
    handleCopyEnd,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleAdd,
    handleAddTag,
    handleDeleteTagItem,
    handleSelectTag,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    handleTimeSlotClick,
    handleWeekdaySelect,
    handleIntervalChange,
    handleRepeatCountChange,
    currentWeek,
    focusedDayIndex,
    form,
    setForm,
    startSlot,
    selectedTagType,
    newTagType,
    setNewTagType,
    newTagName,
    setNewTagName,
    contextMenu,
    copyingSchedule,
    showOverlapMessage,
    safeSchedules,
    safeTags,
    safeTagItems,
    DAYS_OF_WEEK
  ]);

  return <WeeklyCalendarUI {...uiProps} />;
};

// React.memo로 컴포넌트 최적화
const OptimizedWeeklyCalendar = React.memo(WeeklyCalendar);

export default function SimplifiedWeeklyCalendar(props) {
  return <OptimizedWeeklyCalendar {...props} />;
}
