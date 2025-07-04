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
  // 새로운 props 구조
  currentUser,
  onLogout,
  isServerBased = true,
  enableAutoRefresh = false,
  
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
  // ✅ URL 파라미터에서 날짜 가져오기
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  
  console.log('🔍 DayDetailPagecopy URL 정보:', {
    'location.pathname': location.pathname,
    'location.search': location.search,
    'searchParams date': searchParams.get('date'),
    'params date': params.date,
    'params 전체': params
  });
  
  // ✅ 날짜 검증 및 안전한 처리
  const initialDate = useMemo(() => {
    const queryDate = searchParams.get('date');
    if (queryDate && isValidDate(queryDate)) {
      console.log('✅ Query Parameter에서 유효한 날짜:', queryDate);
      return queryDate;
    }
    
    const pathDate = params.date;
    if (pathDate && isValidDate(pathDate)) {
      console.log('✅ Path Parameter에서 유효한 날짜:', pathDate);
      return pathDate;
    }
    
    const pathMatch = location.pathname.match(/\/day\/(\d{4}-\d{2}-\d{2})/);
    if (pathMatch && pathMatch[1] && isValidDate(pathMatch[1])) {
      console.log('✅ URL pathname에서 유효한 날짜 추출:', pathMatch[1]);
      return pathMatch[1];
    }
    
    console.log('⚠️ 날짜 파라미터를 찾을 수 없음 → 오늘 날짜 사용');
    return null;
  }, [searchParams, params, location]);

  console.log('📤 최종 initialDate:', initialDate);

  // ✅ 캘린더 로직 훅 사용
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
    isSaving,
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
    getDayIndexFromKoreanDay, // ✅ 문제 3 해결용 함수
    
    // 서버 관리 함수들
    loadDataFromServer,
    saveDataToServer,
    addSchedule,
    updateSchedule,
    deleteSchedule
  } = calendarLogic;

  // ✅ 하위 호환성을 위한 레거시 상태 업데이트
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

  // ✅ 레거시 상태 업데이트
  React.useEffect(() => {
    updateLegacySchedules(safeSchedules);
  }, [safeSchedules, updateLegacySchedules]);

  React.useEffect(() => {
    updateLegacyTags(safeTags);
  }, [safeTags, updateLegacyTags]);

  React.useEffect(() => {
    updateLegacyTagItems(safeTagItems);
  }, [safeTagItems, updateLegacyTagItems]);

  // 🔧 주별 변경 시 시간 태그 업데이트를 위한 효과
  useEffect(() => {
    console.log('📅 주별 변경 감지 - 시간 태그 업데이트:', {
      currentWeek: currentWeek.map(d => d.toISOString().split('T')[0]),
      focusedDayIndex
    });
  }, [currentWeek, focusedDayIndex]);

  // ✅ 🔧 개선된 컨텍스트 메뉴 핸들러들
  const handleContextMenu = useCallback((e, scheduleId) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🖱️ 컨텍스트 메뉴 열기:', scheduleId);
    
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
      console.log('📋 일정 복사됨:', scheduleToCopy.title);
      
      // 🔧 복사 모드 시각적 피드백
      document.body.style.cursor = 'copy';
      
      // 복사 안내 메시지 표시
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
      // 확인 대화상자
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

  // ✅ 🔧 개선된 복사 관련 핸들러들 - 문제 2 해결
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
    
    console.log('📋 복사 종료 시도:', copyingSchedule.title);
    
    // 🔧 복사 모드 해제
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
          console.log(`✅ 일정 붙여넣기 완료: ${copyingSchedule.title} -> ${getDayOfWeek(currentWeek[targetDayIndex])} ${dropTimeSlot}-${newEnd}`);
          
          // 성공 메시지 표시
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
          console.error('❌ 일정 붙여넣기 실패:', result.error);
          alert('일정 붙여넣기에 실패했습니다: ' + result.error);
        }
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
      }
    }
    
    setCopyingSchedule(null);
  }, [copyingSchedule, currentWeek, pixelToNearestTimeSlot, parseTimeToMinutes, minutesToTimeString, checkScheduleOverlap, safeSchedules, addSchedule, getDayOfWeek, setShowOverlapMessage, setCopyingSchedule]);

  // ✅ 드래그 관련 핸들러들 - 문제 2 해결: 블럭 드래그 기능 강화
  const handleDragStart = useCallback((e, scheduleId) => {
    console.log('🖱️ 드래그 시작 - handleDragStart 호출됨:', scheduleId);
    
    const schedule = safeSchedules.find(s => s.id === scheduleId);
    if (!schedule) {
      console.error('❌ 스케줄을 찾을 수 없음:', scheduleId);
      return;
    }
    
    // 드래그 상태 설정
    setDragging(scheduleId);
    
    // 드래그 오프셋 계산 (마우스 포인터와 엘리먼트 상단 왼쪽 모서리 간의 거리)
    const rect = e.currentTarget.getBoundingClientRect();
    const dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    setDragOffset(dragOffset);
    
    console.log('✅ 드래그 시작 완료:', {
      scheduleId,
      title: schedule.title,
      dragOffset,
      mousePos: { x: e.clientX, y: e.clientY },
      rectPos: { left: rect.left, top: rect.top }
    });
    
    // 커서 변경
    document.body.style.cursor = 'grabbing';
  }, [safeSchedules, setDragging, setDragOffset]);

  const handleDragMove = useCallback((e) => {
    if (!calendarLogic.dragging) return;
    
    // 기본 동작 방지
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🖱️ 드래그 이동 중:', {
      dragging: calendarLogic.dragging,
      mousePos: { x: e.clientX, y: e.clientY }
    });
    
    // 화면 가장자리에서 주간 이동 (옵션)
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
      document.body.style.cursor = 'default';
      return;
    }
    
    console.log('🖱️ 드래그 종료 시작:', {
      dragging: calendarLogic.dragging,
      mousePos: { x: e.clientX, y: e.clientY }
    });
    
    // 드롭 위치 계산 - 더 정확한 방법
    const containers = document.querySelectorAll('[data-day-index]');
    let targetDayIndex = null;
    let targetY = null;
    let targetContainer = null;
    
    // 각 날짜 컨테이너를 확인하여 마우스가 어느 영역에 있는지 판단
    for (const container of containers) {
      const rect = container.getBoundingClientRect();
      console.log(`📍 컨테이너 ${container.dataset.dayIndex} 체크:`, {
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        mouse: { x: e.clientX, y: e.clientY },
        isInX: e.clientX >= rect.left && e.clientX <= rect.right,
        isInY: e.clientY >= rect.top && e.clientY <= rect.bottom
      });
      
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        targetDayIndex = parseInt(container.dataset.dayIndex);
        targetY = e.clientY - rect.top;
        targetContainer = container;
        console.log('✅ 타겟 컨테이너 찾음:', { targetDayIndex, targetY });
        break;
      }
    }
    
    if (targetDayIndex !== null && targetY !== null) {
      const schedule = safeSchedules.find(s => s.id === calendarLogic.dragging);
      if (!schedule) {
        console.error('❌ 드래그 중인 스케줄을 찾을 수 없음:', calendarLogic.dragging);
        setDragging(null);
        document.body.style.cursor = 'default';
        return;
      }
      
      // 🔧 스크롤 위치 고려한 Y 좌표 계산 수정
      const scrollContainer = document.querySelector('.overflow-y-auto');
      const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
      
      // 드래그 오프셋을 빼지 말고, 단순히 클릭한 Y 위치로 계산
      const adjustedY = targetY + scrollTop;
      
      console.log('📐 Y 좌표 계산:', {
        originalY: targetY,
        scrollTop,
        adjustedY,
        dragOffset: calendarLogic.dragOffset
      });
      
      // 새로운 날짜와 시간 계산
      const newDate = currentWeek[targetDayIndex].toISOString().split("T")[0];
      const newStartTime = pixelToNearestTimeSlot(adjustedY);
      
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
      
      const updatedSchedule = { ...schedule, ...updatedData };
      
      console.log('📅 일정 이동 계산:', {
        원본: {
          id: schedule.id,
          date: schedule.date,
          start: schedule.start,
          end: schedule.end,
          title: schedule.title
        },
        새위치: {
          date: newDate,
          start: newStartTime,
          end: newEndTime,
          targetDay: getDayOfWeek(currentWeek[targetDayIndex])
        },
        지속시간: `${duration}분`
      });
      
      // 🔧 겹침 검사 개선 - 자기 자신은 제외하고 검사
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
          console.log(`✅ 일정 이동 완료: ${schedule.title} -> ${getDayOfWeek(currentWeek[targetDayIndex])} ${newStartTime}-${newEndTime}`);
          
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
          message.textContent = `일정 이동 완료: ${schedule.title}`;
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
        console.warn('⚠️ 일정 겹침 감지:', {
          충돌일정: conflictSchedule.title,
          충돌시간: `${conflictSchedule.start}-${conflictSchedule.end}`,
          새시간: `${newStartTime}-${newEndTime}`
        });
        
        // 더 구체적인 겹침 메시지
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
    } else {
      console.log('🚫 유효한 드롭 위치를 찾지 못함');
    }
    
    // 드래그 상태 초기화
    setDragging(null);
    document.body.style.cursor = 'default';
    console.log('🏁 드래그 종료 완료');
  }, [calendarLogic.dragging, calendarLogic.dragOffset, safeSchedules, currentWeek, pixelToNearestTimeSlot, parseTimeToMinutes, minutesToTimeString, updateSchedule, setDragging, getDayOfWeek]);

  // ✅ 🔧 개선된 일정 추가 핸들러 (문제 3 해결 - 요일 선택 반복 설정)
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
    
    // ✅ 문제 3 해결: 요일 선택 처리 개선
    const selectedWeekdays = form.weekdays && form.weekdays.length > 0
      ? form.weekdays
      : [DAYS_OF_WEEK[focusedDayIndex]]; // 선택된 요일이 없으면 현재 요일 사용
  
    console.log('📅 선택된 요일들:', selectedWeekdays, 'focusedDayIndex:', focusedDayIndex);
  
    const newSchedules = [];
  
    for (let week = 0; week < repeatCount; week++) {
      for (const koreanWeekday of selectedWeekdays) {
        // ✅ 한국어 요일을 인덱스로 변환
        const weekdayIndex = getDayIndexFromKoreanDay(koreanWeekday);
        if (weekdayIndex === -1) {
          console.warn('⚠️ 잘못된 요일:', koreanWeekday);
          continue;
        }
  
        // 현재 주의 해당 요일 날짜 계산
        const currentWeekDate = currentWeek[weekdayIndex];
        
        // 반복 간격을 고려하여 미래 날짜 계산
        const targetDate = new Date(currentWeekDate);
        targetDate.setDate(currentWeekDate.getDate() + (week * 7 * interval));
  
        const schedule = {
          ...baseSchedule,
          id: Date.now() + week * 10000 + weekdayIndex * 100 + Math.random() * 100,
          date: targetDate.toISOString().split("T")[0],
        };
  
        console.log(`📅 일정 생성: ${koreanWeekday}(${weekdayIndex}) -> ${schedule.date}`);
  
        if (checkScheduleOverlap(safeSchedules, schedule)) {
          alert(`${targetDate.toLocaleDateString()} ${koreanWeekday}에 시간 겹침이 발생하여 일정 추가를 중단합니다.`);
          return;
        }
  
        newSchedules.push(schedule);
      }
    }
  
    console.log(`📅 총 ${newSchedules.length}개의 일정을 추가합니다:`, newSchedules);
  
    // 모든 일정을 순차적으로 추가
    let addedCount = 0;
    for (const schedule of newSchedules) {
      const result = await addSchedule(schedule);
      if (result.success) {
        addedCount++;
        console.log(`✅ 일정 추가 완료 (${addedCount}/${newSchedules.length}):`, schedule.title, schedule.date);
      } else {
        console.error('❌ 일정 추가 실패:', result.error);
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
  
  // ✅ 🔧 개선된 태그 추가 핸들러 (즉시 반영)
  const handleAddTag = useCallback(async () => {
    if (!newTagType.trim() || !newTagName.trim()) {
      alert('태그 타입과 태그 이름을 모두 입력해주세요.');
      return;
    }
    
    console.log('🏷️ 새 태그 추가 시도:', { newTagType, newTagName });
    
    try {
      // 태그 타입이 없으면 추가
      let updatedTags = [...safeTags];
      if (!safeTags.find(t => t.tagType === newTagType)) {
        const newColor = assignNewTagColor(newTagType);
        updatedTags = [...safeTags, { tagType: newTagType, color: newColor }];
        console.log('🎨 새 태그 타입 추가:', { tagType: newTagType, color: newColor });
      }
      
      // 태그 아이템 중복 확인
      if (safeTagItems.find(t => t.tagType === newTagType && t.tagName === newTagName)) {
        alert('이미 존재하는 태그입니다.');
        return;
      }
      
      const updatedTagItems = [...safeTagItems, { tagType: newTagType, tagName: newTagName }];
      
      // 🔧 서버에 저장 (즉시 반영)
      if (isServerBased && currentUser) {
        console.log('💾 서버에 태그 저장 중...');
        
        const result = await saveDataToServer({
          schedules: safeSchedules,
          tags: updatedTags,
          tagItems: updatedTagItems,
          monthlyGoals: calendarLogic.safeMonthlyGoals || []
        });
        
        if (result.success) {
          console.log('✅ 태그 추가 완료:', newTagType, newTagName);
          
          // 🔧 즉시 UI 업데이트를 위한 강제 새로고침
          await loadDataFromServer(true);
          
          // 성공 메시지
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
          console.error('❌ 태그 추가 실패:', result.error);
          alert('태그 추가에 실패했습니다: ' + result.error);
          return;
        }
      } else if (!isServerBased) {
        // 레거시 모드에서는 직접 상태 업데이트
        updateLegacyTags(updatedTags);
        updateLegacyTagItems(updatedTagItems);
      }
      
      // 입력 필드 초기화
      setNewTagType(""); 
      setNewTagName("");
      
    } catch (error) {
      console.error('❌ 태그 추가 중 오류:', error);
      alert('태그 추가 중 오류가 발생했습니다.');
    }
  }, [newTagType, newTagName, safeTags, safeTagItems, assignNewTagColor, isServerBased, currentUser, saveDataToServer, safeSchedules, calendarLogic.safeMonthlyGoals, updateLegacyTags, updateLegacyTagItems, setNewTagType, setNewTagName, loadDataFromServer]);
  
  // ✅ 태그 삭제 핸들러
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
        console.log('✅ 태그 삭제 완료:', tagType, tagName);
        // 즉시 UI 업데이트
        await loadDataFromServer(true);
      } else {
        console.error('❌ 태그 삭제 실패:', result.error);
        alert('태그 삭제에 실패했습니다: ' + result.error);
      }
    } else if (!isServerBased) {
      updateLegacyTagItems(updatedTagItems);
    }
  }, [safeTagItems, isServerBased, currentUser, saveDataToServer, safeSchedules, safeTags, calendarLogic.safeMonthlyGoals, updateLegacyTagItems, loadDataFromServer]);

  // ✅ 태그 선택 핸들러
  const handleSelectTag = useCallback((tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm({ ...form, tag: tagName });
  }, [form, setSelectedTagType, setForm]);

  // ✅ 🔧 개선된 주간 네비게이션 (시간 태그 업데이트 포함)
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
      
      console.log('📅 이전 주로 이동 - 시간 태그 업데이트 필요');
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
      
      console.log('📅 다음 주로 이동 - 시간 태그 업데이트 필요');
      return newWeek;
    });
  }, [focusedDayIndex, setCurrentWeek, setVisibleDays]);
  
  const goToCurrentWeek = useCallback(() => {
    const currentDate = new Date();
    
    // currentWeek 설정 (일요일부터 토요일까지)
    const newCurrentWeek = Array(7).fill().map((_, i) => {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() - currentDate.getDay() + i);
      return date;
    });
    setCurrentWeek(newCurrentWeek);
    
    // focusedDayIndex 설정 (오늘 요일)
    setFocusedDayIndex(currentDate.getDay());
    
    // visibleDays를 오늘 날짜를 중심으로 정확히 계산
    const newVisibleDays = [];
    for (let i = -2; i <= 2; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      newVisibleDays.push(date);
    }
    setVisibleDays(newVisibleDays);
    
    console.log('📅 현재 주로 이동 - 시간 태그 업데이트 필요');
  }, [setCurrentWeek, setFocusedDayIndex, setVisibleDays]);
  
  // ✅ 시간 슬롯 클릭 핸들러
  const handleTimeSlotClick = useCallback((time) => {
    setStartSlot(time);
    setActiveTimeSlot(time);
    
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + 60; // 기본 1시간
    const endTime = minutesToTimeString(endMinutes);
    setForm({ ...form, end: endTime });
    
    console.log('🕐 시간 슬롯 선택:', time, '→', endTime);
  }, [form, setStartSlot, setActiveTimeSlot, setForm, parseTimeToMinutes, minutesToTimeString]);
  
  // ✅ 🔧 요일 선택 핸들러 (개선된 UI 반영)
  const handleWeekdaySelect = useCallback((weekday) => {
    const currentWeekdays = [...(form.weekdays || [])];
    
    if (currentWeekdays.includes(weekday)) {
      setForm({
        ...form,
        weekdays: currentWeekdays.filter(day => day !== weekday)
      });
      console.log('📅 요일 선택 해제:', weekday);
    } else {
      setForm({
        ...form,
        weekdays: [...currentWeekdays, weekday]
      });
      console.log('📅 요일 선택:', weekday);
    }
  }, [form, setForm]);

  // ✅ 🔧 반복 간격 설정 핸들러 (새로 추가)
  const handleIntervalChange = useCallback((interval) => {
    setForm({
      ...form,
      interval: interval.toString()
    });
    console.log('🔄 반복 간격 설정:', interval);
  }, [form, setForm]);

  // ✅ 🔧 반복 횟수 설정 핸들러 (새로 추가)
  const handleRepeatCountChange = useCallback((count) => {
    setForm({
      ...form,
      repeatCount: count.toString()
    });
    console.log('🔢 반복 횟수 설정:', count);
  }, [form, setForm]);

  // ✅ 수동 새로고침 핸들러
  const handleManualRefresh = useCallback(async () => {
    if (isServerBased) {
      console.log('🔄 수동 새로고침 시작...');
      const result = await loadDataFromServer(true); // 강제 새로고침
      if (result.success) {
        console.log('✅ 수동 새로고침 완료');
        
        // 새로고침 완료 메시지
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
        console.error('❌ 수동 새로고침 실패:', result.error);
        alert('데이터 새로고침에 실패했습니다: ' + result.error);
      }
    }
  }, [isServerBased, loadDataFromServer]);

  // ✅ 🔧 복사 모드 취소 핸들러 (ESC 키)
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && copyingSchedule) {
        console.log('📋 복사 모드 취소 (ESC)');
        setCopyingSchedule(null);
        document.body.style.cursor = 'default';
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [copyingSchedule, setCopyingSchedule]);

  // ✅ 🔧 전역 클릭 이벤트 (컨텍스트 메뉴 닫기)
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

  // ✅ UI 컴포넌트에 전달할 props를 useMemo로 최적화
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

// ✅ React.memo로 컴포넌트 최적화
const OptimizedWeeklyCalendar = React.memo(WeeklyCalendar);

export default function SimplifiedWeeklyCalendar(props) {
  return <OptimizedWeeklyCalendar {...props} />;
}
