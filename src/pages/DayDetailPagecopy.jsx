import React from "react";
import { useWeeklyCalendarLogic } from "./WeeklyCalendarLogic";
import { WeeklyCalendarUI } from "./WeeklyCalendarUI";
import { saveUserDataToDAL } from './utils/supabaseStorage.js';

const WeeklyCalendar = ({ 
  schedules = [], 
  setSchedules, 
  tags = [], 
  setTags, 
  tagItems = [], 
  setTagItems, 
  currentUser,
  onLogout,
  saveToServer,
  loadFromServer
}) => {
  // 로직 훅 사용
  const calendarLogic = useWeeklyCalendarLogic({
    schedules,
    setSchedules,
    tags,
    setTags,
    tagItems,
    setTagItems,
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
    if (setSchedules && currentUser) {
      const scheduleToDelete = safeSchedules.find(s => s.id === contextMenu.scheduleId);
      const updatedSchedules = safeSchedules.filter(s => s.id !== contextMenu.scheduleId);
      
      setSchedules(updatedSchedules);
      
      saveUserDataToDAL(currentUser, {
        schedules: updatedSchedules,
        tags: safeTags,
        tagItems: safeTagItems
      });
      
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
    if (!copyingSchedule || !setSchedules) return;
    
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
        setSchedules(updatedSchedules);
        
        if (currentUser) {
          saveUserDataToDAL(currentUser, {
            schedules: updatedSchedules,
            tags: safeTags,
            tagItems: safeTagItems
          });
        }
        
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
      handleDayFocus(newIndex);
    } else if (e.clientX > screenWidth - edgeThreshold) {
      const newIndex = (focusedDayIndex + 1) % 7;
      handleDayFocus(newIndex);
    }
  };

  const handleDragEnd = (e) => {
    if (!calendarLogic.dragging || !setSchedules) {
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
        setSchedules(updatedSchedules);
        
        if (currentUser) {
          saveUserDataToDAL(currentUser, {
            schedules: updatedSchedules,
            tags: safeTags,
            tagItems: safeTagItems
          });
        }
        
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
  
    if (setSchedules && currentUser) {
      const updatedSchedules = [...safeSchedules, ...newSchedules];
      setSchedules(updatedSchedules);
      
      saveUserDataToDAL(currentUser, {
        schedules: updatedSchedules,
        tags: safeTags,
        tagItems: safeTagItems
      });
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
    if (!newTagType.trim() || !newTagName.trim()) return;
    
    let updatedTags = [...safeTags];
    if (!safeTags.find(t => t.tagType === newTagType)) {
      const newColor = assignNewTagColor(newTagType);
      updatedTags = [...safeTags, { tagType: newTagType, color: newColor }];
      if (setTags) {
        setTags(updatedTags);
      }
    }
    
    if (!safeTagItems.find(t => t.tagType === newTagType && t.tagName === newTagName)) {
      const updatedTagItems = [...safeTagItems, { tagType: newTagType, tagName: newTagName }];
      if (setTagItems) {
        setTagItems(updatedTagItems);
      }
      
      if (currentUser) {
        saveUserDataToDAL(currentUser, {
          schedules: safeSchedules,
          tags: updatedTags,
          tagItems: updatedTagItems
        });
      }
    }
    
    setNewTagType(""); 
    setNewTagName("");
  };
  
  // 태그 삭제 핸들러
  const handleDeleteTagItem = (tagType, tagName) => {
    if (setTagItems && currentUser) {
      const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
      setTagItems(updatedTagItems);
      
      saveUserDataToDAL(currentUser, {
        schedules: safeSchedules,
        tags: safeTags,
        tagItems: updatedTagItems
      });
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
  
  // 요일 선택 핸들러
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

  return (
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
    />
  );
};

export default function SimplifiedWeeklyCalendar(props) {
  return <WeeklyCalendar {...props} />;
}
