import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveUserCoreData } from './utils/supabaseStorage.js';

const SLOT_HEIGHT = 24;
const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 파스텔 색상 팔레트
const PASTEL_COLORS = [
  { bg: "bg-purple-100", text: "text-purple-800" },
  { bg: "bg-blue-100", text: "text-blue-800" },
  { bg: "bg-green-100", text: "text-green-800" },
  { bg: "bg-yellow-100", text: "text-yellow-800" },
  { bg: "bg-red-100", text: "text-red-800" },
  { bg: "bg-pink-100", text: "text-pink-800" },
  { bg: "bg-indigo-100", text: "text-indigo-800" },
  { bg: "bg-cyan-100", text: "text-cyan-800" },
  { bg: "bg-teal-100", text: "text-teal-800" },
  { bg: "bg-orange-100", text: "text-orange-800" },
];

// 유틸리티 함수들
const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTimeString = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const pixelToNearestTimeSlot = (pixelPosition) => {
  const slotIndex = Math.round(pixelPosition / SLOT_HEIGHT);
  const totalMinutes = slotIndex * 30;
  return minutesToTimeString(totalMinutes);
};

const formatDate = (date) => {
  return date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
};

const getDayOfWeek = (date) => {
  return DAYS_OF_WEEK[date.getDay()];
};

const filterSchedulesByDate = (schedules, date) => {
  const dateString = date.toISOString().split("T")[0];
  return schedules.filter(schedule => schedule.date === dateString);
};

const calculateTagTotals = (schedules) => {
  const totals = {};
  
  schedules.forEach(schedule => {
    const tagType = schedule.tagType || "기타";
    if (!totals[tagType]) {
      totals[tagType] = 0;
    }
    
    const startMinutes = parseTimeToMinutes(schedule.start);
    const endMinutes = parseTimeToMinutes(schedule.end);
    const duration = endMinutes - startMinutes;
    
    totals[tagType] += duration;
  });
  
  Object.keys(totals).forEach(key => {
    const hours = Math.floor(totals[key] / 60);
    const minutes = totals[key] % 60;
    totals[key] = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  });
  
  return totals;
};

const checkScheduleOverlap = (schedules, newSchedule) => {
  const filtered = schedules.filter(s => 
    s.date === newSchedule.date && s.id !== newSchedule.id
  );
  
  const newStart = parseTimeToMinutes(newSchedule.start);
  const newEnd = parseTimeToMinutes(newSchedule.end);
  
  return filtered.some(s => {
    const existingStart = parseTimeToMinutes(s.start);
    const existingEnd = parseTimeToMinutes(s.end);
    
    return (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    );
  });
};

const WeeklyCalendar = ({ 
  schedules = [], 
  setSchedules, 
  tags = [], 
  setTags, 
  tagItems = [], 
  setTagItems, 
  currentUser,
  onLogout,
  saveToServer,    // 추가된 props
  loadFromServer   // 추가된 props
}) => {
  const navigate = useNavigate();

  // 안전한 배열 보장
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];

  // 날짜 상태 관리 - 클릭한 날짜 중심으로 연속된 날짜들 생성
  const today = new Date();
  const [centerDate, setCenterDate] = useState(today);
  
  const [currentWeek, setCurrentWeek] = useState(() => {
    // 센터 날짜를 기준으로 앞뒤 30일씩 총 61일 생성
    const dates = [];
    for (let i = -30; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  });
  
  const [focusedDayIndex, setFocusedDayIndex] = useState(30); // 가운데 인덱스 (오늘)
  
  const [visibleDays, setVisibleDays] = useState(() => {
    const focusPosition = 2; // 가운데 위치
    const newVisibleDays = [];
    for (let i = 0; i < 5; i++) {
      const offset = i - focusPosition;
      const newIndex = 30 + offset; // 오늘 기준 앞뒤 2일
      newVisibleDays.push(newIndex);
    }
    return newVisibleDays;
  });
  
  // 시간 슬롯
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  });

  // 상태들
  const [form, setForm] = useState({ 
    title: "", 
    end: "07:00", 
    description: "", 
    tag: "",
    repeatCount: "1",
    interval: "1",
    weekdays: []
  });
  const [startSlot, setStartSlot] = useState("07:00");
  const [activeTimeSlot, setActiveTimeSlot] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [resizeType, setResizeType] = useState(null);
  const containerRef = useRef(null);
  const [showOverlapMessage, setShowOverlapMessage] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    scheduleId: null
  });
  const [copyingSchedule, setCopyingSchedule] = useState(null);
  const [newTagType, setNewTagType] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagType, setSelectedTagType] = useState("");
  
  // 드래그 앤 드롭 상태
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [autoScrollTimer, setAutoScrollTimer] = useState(null);
  
  const repeatOptions = Array.from({ length: 15 }, (_, i) => i + 2);
  const intervalOptions = [
    { value: "1", label: "매주" },
    { value: "2", label: "격주" },
    { value: "3", label: "3주마다" },
    { value: "4", label: "4주마다" }
  ];

  // 초기 스크롤 설정
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 12 * SLOT_HEIGHT;
    }
  }, []);

  // 현재 시간 표시 라인 위치 계산
  const getCurrentTimeLine = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const slotPosition = (totalMinutes / 30) * SLOT_HEIGHT;
    return slotPosition;
  };

  // 새 태그 타입에 색상 할당
  const assignNewTagColor = (tagType) => {
    const existingTag = safeTags.find(t => t.tagType === tagType);
    if (existingTag) {
      return existingTag.color;
    }
    
    const usedColors = safeTags.map(t => t.color);
    const availableColors = PASTEL_COLORS.filter(
      color => !usedColors.some(used => used.bg === color.bg)
    );
    
    return availableColors.length > 0 
      ? availableColors[0] 
      : PASTEL_COLORS[safeTags.length % PASTEL_COLORS.length];
  };

  // 특정 날짜로 이동하는 함수 추가
  const goToDate = (targetDate) => {
    setCenterDate(targetDate);
    
    // 새로운 날짜 배열 생성
    const newDates = [];
    for (let i = -30; i <= 30; i++) {
      const date = new Date(targetDate);
      date.setDate(targetDate.getDate() + i);
      newDates.push(date);
    }
    setCurrentWeek(newDates);
    
    // 포커스와 visible days 업데이트
    setFocusedDayIndex(30); // 항상 가운데
    
    const newVisibleDays = [];
    for (let i = 0; i < 5; i++) {
      const offset = i - 2; // 가운데 위치
      const newIndex = 30 + offset;
      newVisibleDays.push(newIndex);
    }
    setVisibleDays(newVisibleDays);
  };
  // 포커스 날짜 변경 핸들러 - 클릭한 날짜로 새로운 배열 생성
  const handleDayFocus = (dayIndex) => {
    if (dayIndex === focusedDayIndex) return;
    
    const clickedDate = currentWeek[dayIndex];
    goToDate(clickedDate);
  };

  // 시간 슬롯 계산 헬퍼 함수
  const calculateSlotPosition = (time) => {
    const minutes = parseTimeToMinutes(time);
    const slotIndex = minutes / 30;
    return slotIndex * SLOT_HEIGHT;
  };

  // 리사이즈 핸들러들
  const handleResizeStart = (e, scheduleId, type) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(scheduleId);
    setResizeType(type);
  };

  const handleResizeMove = (e) => {
    if (!resizing || !containerRef.current || !setSchedules) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - containerRect.top + containerRef.current.scrollTop;
    
    const scheduleIndex = safeSchedules.findIndex(s => s.id === resizing);
    if (scheduleIndex === -1) return;
    
    const schedule = safeSchedules[scheduleIndex];
    const updatedSchedules = [...safeSchedules];
    
    if (resizeType === 'top') {
      const newStart = pixelToNearestTimeSlot(relativeY);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const newStartMinutes = parseTimeToMinutes(newStart);
      
      if (newStartMinutes < endMinutes) {
        const updatedSchedule = {
          ...schedule,
          start: newStart
        };
        
        if (!checkScheduleOverlap(safeSchedules, updatedSchedule)) {
          updatedSchedules[scheduleIndex] = updatedSchedule;
          setSchedules(updatedSchedules);
          
          // storage에도 반영
          if (currentUser) {
            saveUserCoreData(currentUser, {
              schedules: updatedSchedules,
              tags: safeTags,
              tagItems: safeTagItems
            });
          }
        } else {
          setShowOverlapMessage(true);
          setTimeout(() => setShowOverlapMessage(false), 3000);
        }
      }
    } else if (resizeType === 'bottom') {
      const newEnd = pixelToNearestTimeSlot(relativeY);
      const startMinutes = parseTimeToMinutes(schedule.start);
      const newEndMinutes = parseTimeToMinutes(newEnd);
      
      if (newEndMinutes > startMinutes) {
        const updatedSchedule = {
          ...schedule,
          end: newEnd
        };
        
        if (!checkScheduleOverlap(safeSchedules, updatedSchedule)) {
          updatedSchedules[scheduleIndex] = updatedSchedule;
          setSchedules(updatedSchedules);
          
          // storage에도 반영
          if (currentUser) {
            saveUserCoreData(currentUser, {
              schedules: updatedSchedules,
              tags: safeTags,
              tagItems: safeTagItems
            });
          }
        } else {
          setShowOverlapMessage(true);
          setTimeout(() => setShowOverlapMessage(false), 3000);
        }
      }
    }
  };
  
  const handleResizeEnd = () => {
    setResizing(null);
    setResizeType(null);
  };

  // 오른쪽 클릭 메뉴 핸들러
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
      
      // 로컬 상태 업데이트
      setSchedules(updatedSchedules);
      
      // storage에도 반영
      saveUserCoreData(currentUser, {
        schedules: updatedSchedules,
        tags: safeTags,
        tagItems: safeTagItems
      });
      
      console.log('일정 삭제됨:', scheduleToDelete?.title);
      console.log('💾 storage에 삭제 반영됨');
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  // 복사 모드 핸들러들
  const handleCopyMove = (e) => {
    if (!copyingSchedule) return;
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      if (!autoScrollTimer) {
        const timer = setTimeout(() => {
          const newIndex = (focusedDayIndex - 1 + 7) % 7;
          handleDayFocus(newIndex);
          setAutoScrollTimer(null);
          console.log('복사 모드 - 이전 요일로 이동:', DAYS_OF_WEEK[newIndex]);
        }, 300);
        setAutoScrollTimer(timer);
      }
    } else if (e.clientX > screenWidth - edgeThreshold) {
      if (!autoScrollTimer) {
        const timer = setTimeout(() => {
          const newIndex = (focusedDayIndex + 1) % 7;
          handleDayFocus(newIndex);
          setAutoScrollTimer(null);
          console.log('복사 모드 - 다음 요일로 이동:', DAYS_OF_WEEK[newIndex]);
        }, 300);
        setAutoScrollTimer(timer);
      }
    } else {
      if (autoScrollTimer) {
        clearTimeout(autoScrollTimer);
        setAutoScrollTimer(null);
      }
    }
  };

  const handleCopyEnd = (e) => {
    if (!copyingSchedule || !setSchedules) return;
    
    if (autoScrollTimer) {
      clearTimeout(autoScrollTimer);
      setAutoScrollTimer(null);
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
        
        // storage에도 반영
        if (currentUser) {
          saveUserCoreData(currentUser, {
            schedules: updatedSchedules,
            tags: safeTags,
            tagItems: safeTagItems
          });
        }
        
        console.log(`일정 붙여넣기 완료: ${copyingSchedule.title} -> ${getDayOfWeek(currentWeek[targetDayIndex])} ${dropTimeSlot}-${newEnd}`);
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
        console.log('일정 붙여넣기 실패: 겹치는 일정이 있습니다');
      }
    }
    
    setCopyingSchedule(null);
  };

  // 드래그 앤 드롭 핸들러들
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
    
    console.log('드래그 시작:', schedule.title);
  };

  const handleDragMove = (e) => {
    if (!dragging) return;
    
    e.preventDefault();
    
    const screenWidth = window.innerWidth;
    const edgeThreshold = 100;
    
    if (e.clientX < edgeThreshold) {
      if (!autoScrollTimer) {
        const timer = setTimeout(() => {
          const newIndex = (focusedDayIndex - 1 + 7) % 7;
          handleDayFocus(newIndex);
          setAutoScrollTimer(null);
          console.log('이전 요일로 이동:', DAYS_OF_WEEK[newIndex]);
        }, 300);
        setAutoScrollTimer(timer);
      }
    } else if (e.clientX > screenWidth - edgeThreshold) {
      if (!autoScrollTimer) {
        const timer = setTimeout(() => {
          const newIndex = (focusedDayIndex + 1) % 7;
          handleDayFocus(newIndex);
          setAutoScrollTimer(null);
          console.log('다음 요일로 이동:', DAYS_OF_WEEK[newIndex]);
        }, 300);
        setAutoScrollTimer(timer);
      }
    } else {
      if (autoScrollTimer) {
        clearTimeout(autoScrollTimer);
        setAutoScrollTimer(null);
      }
    }
  };

  const handleDragEnd = (e) => {
    if (!dragging || !setSchedules) {
      setDragging(null);
      if (autoScrollTimer) {
        clearTimeout(autoScrollTimer);
        setAutoScrollTimer(null);
      }
      return;
    }
    
    if (autoScrollTimer) {
      clearTimeout(autoScrollTimer);
      setAutoScrollTimer(null);
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
      const schedule = safeSchedules.find(s => s.id === dragging);
      if (!schedule) {
        setDragging(null);
        return;
      }
      
      const newDate = currentWeek[targetDayIndex].toISOString().split("T")[0];
      const newStartTime = pixelToNearestTimeSlot(targetY - dragOffset.y);
      
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
          s.id === dragging ? updatedSchedule : s
        );
        setSchedules(updatedSchedules);
        
        // storage에도 반영
        if (currentUser) {
          saveUserCoreData(currentUser, {
            schedules: updatedSchedules,
            tags: safeTags,
            tagItems: safeTagItems
          });
        }
        
        console.log(`일정 이동 완료: ${schedule.title} -> ${getDayOfWeek(currentWeek[targetDayIndex])} ${newStartTime}-${newEndTime}`);
        console.log('💾 storage에 이동 반영됨');
      } else {
        setShowOverlapMessage(true);
        setTimeout(() => setShowOverlapMessage(false), 3000);
        console.log('일정 이동 실패: 겹치는 일정이 있습니다');
      }
    }
    
    setDragging(null);
  };

  // 나머지 핸들러들
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
      
      // storage에도 반영
      saveUserCoreData(currentUser, {
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
      
      // storage에도 반영
      if (currentUser) {
        saveUserCoreData(currentUser, {
          schedules: safeSchedules,
          tags: updatedTags,
          tagItems: updatedTagItems
        });
      }
    }
    
    setNewTagType(""); 
    setNewTagName("");
  };
  
  const handleDeleteTagItem = (tagType, tagName) => {
    if (setTagItems && currentUser) {
      const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
      setTagItems(updatedTagItems);
      
      // storage에도 반영
      saveUserCoreData(currentUser, {
        schedules: safeSchedules,
        tags: safeTags,
        tagItems: updatedTagItems
      });
    }
  };

  const getTagColor = (tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : { bg: "bg-gray-100", text: "text-gray-800" };
  };

  const handleSelectTag = (tagType, tagName) => {
    setSelectedTagType(tagType);
    setForm({ ...form, tag: tagName });
  };

  const goToPreviousWeek = () => {
    const newCenterDate = new Date(centerDate);
    newCenterDate.setDate(centerDate.getDate() - 1);
    goToDate(newCenterDate);
  };

  const goToNextWeek = () => {
    const newCenterDate = new Date(centerDate);
    newCenterDate.setDate(centerDate.getDate() + 1);
    goToDate(newCenterDate);
  };

  const goToCurrentWeek = () => {
    goToDate(new Date());
  };
  
  const handleTimeSlotClick = (time) => {
    setStartSlot(time);
    setActiveTimeSlot(time);
    
    const startMinutes = parseTimeToMinutes(time);
    const endMinutes = startMinutes + 60;
    const endTime = minutesToTimeString(endMinutes);
    setForm({ ...form, end: endTime });
  };
  
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

  const tagTotals = calculateTagTotals(safeSchedules);

  // 이벤트 리스너 등록
  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }
    
    if (copyingSchedule) {
      window.addEventListener('mousemove', handleCopyMove);
      window.addEventListener('mouseup', handleCopyEnd);
    }
    
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    }
    
    if (contextMenu.visible) {
      const handleClickOutside = () => {
        setContextMenu({ ...contextMenu, visible: false });
      };
      window.addEventListener('click', handleClickOutside);
      return () => window.removeEventListener('click', handleClickOutside);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('mousemove', handleCopyMove);
      window.removeEventListener('mouseup', handleCopyEnd);
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      
      if (autoScrollTimer) {
        clearTimeout(autoScrollTimer);
      }
    };
  }, [resizing, copyingSchedule, dragging, contextMenu.visible, autoScrollTimer, dragOffset, focusedDayIndex]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* 중복 알림 메시지 */}
      {showOverlapMessage && (
        <div className="fixed top-4 right-4 bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-md z-50">
          일정이 다른 일정과 겹칩니다
        </div>
      )}
      
      {/* 복사 모드 안내 메시지 */}
      {copyingSchedule && (
        <div className="fixed top-4 left-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-md z-50">
          📋 복사 모드: "{copyingSchedule.title}" - 원하는 위치에 클릭하세요
        </div>
      )}
      
      {/* 오른쪽 클릭 메뉴 */}
      {contextMenu.visible && (
        <div 
          className="fixed bg-white shadow-lg rounded-lg overflow-hidden z-50 border"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div 
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" 
            onClick={handleCopySchedule}
          >
            📋 복사
          </div>
          <div 
            className="px-4 py-2 hover:bg-gray-100 text-red-600 cursor-pointer text-sm" 
            onClick={handleDeleteSchedule}
          >
            🗑️ 삭제
          </div>
        </div>
      )}
      
      {/* 헤더 및 상단 요약바 */}
      <div className="bg-white shadow-sm p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          {/* 왼쪽: Back 버튼 */}
          <button 
            className="text-blue-600 flex items-center font-medium"
            onClick={() => navigate("/calendar")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" className="mr-1">
              <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          
          {/* 가운데: This Week 버튼 */}
          <div className="flex gap-2">
            <button 
              className="bg-gray-100 rounded-lg px-3 py-1 text-sm"
              onClick={goToPreviousWeek}
            >
              &lt;
            </button>
            <button 
              className="bg-blue-100 text-blue-700 rounded-lg px-3 py-1 text-sm font-medium"
              onClick={goToCurrentWeek}
            >
              This Week
            </button>
            <button 
              className="bg-gray-100 rounded-lg px-3 py-1 text-sm"
              onClick={goToNextWeek}
            >
              &gt;
            </button>
          </div>
          
          {/* 오른쪽: 날짜 + 사용자 정보 */}
          <div className="flex items-center gap-4">
            <div className="text-gray-800 font-semibold">
              {currentWeek.length > 0 && visibleDays.length > 0 ? 
                `${formatDate(currentWeek[visibleDays[0]])} - ${formatDate(currentWeek[visibleDays[visibleDays.length - 1]])}` 
                : ''
              }
            </div>
            {currentUser && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🧑‍💻 {currentUser}</span>
                <button
                  onClick={onLogout}
                  className="text-red-500 hover:text-red-700 underline"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* 태그별 총 시간 요약 */}
        <div className="flex gap-4 flex-wrap">
          {Object.entries(tagTotals).map(([tagType, totalTime]) => {
            const tagColor = getTagColor(tagType);
            return (
              <div 
                key={tagType} 
                className={`${tagColor.bg} ${tagColor.text} rounded-lg px-3 py-1 text-sm font-medium flex items-center`}
              >
                <span>{tagType}</span>
                <span className="ml-2 font-bold">{totalTime}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 캘린더 그리드 */}
        <div className="flex-1 flex overflow-hidden">
          <div 
            ref={containerRef}
            className="flex-1 overflow-y-auto relative"
            style={{ height: 'calc(100vh - 100px)' }}
          >
            <div className="flex flex-col">
              {/* 상단 헤더 */}
              <div className="sticky top-0 z-10 flex bg-white border-b border-gray-200">
                <div className="w-10 flex-shrink-0 bg-white border-r border-gray-200" />
                {visibleDays.map((dayIndex, i) => {
                  const date = currentWeek[dayIndex];
                  const isFocusDay = i === 2; // 가운데가 포커스
                  return (
                    <div
                      key={dayIndex}
                      className={`p-2 text-center border-l border-gray-200 cursor-pointer ${
                        isFocusDay ? 'bg-blue-50 font-bold' : 'bg-white'
                      }`}
                      style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                      onClick={() => handleDayFocus(dayIndex)}
                    >
                      <div>{getDayOfWeek(date)}</div>
                      <div className="text-sm">{formatDate(date)}</div>
                    </div>
                  );
                })}
              </div>

              {/* 콘텐츠 */}
              <div className="flex">
                {/* 시간 열 */}
                <div className="w-10 flex-shrink-0 relative" style={{ height: `${SLOT_HEIGHT * 48}px` }}>
                  {timeSlots.map((time, i) => (
                    <div
                      key={time}
                      className="absolute w-full pl-2 text-xs text-gray-500"
                      style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                    >
                      <div className="text-right pr-1">{time}</div>
                    </div>
                  ))}
                </div>

                {/* 날짜 열들 */}
                <div className="flex flex-1 min-w-0">
                  {visibleDays.map((dayIndex, i) => {
                    const date = currentWeek[dayIndex];
                    const isFocusDay = i === 2; // 가운데가 포커스
                    const dateSchedules = filterSchedulesByDate(safeSchedules, date);

                    return (
                      <div
                        key={dayIndex}
                        data-day-index={dayIndex}
                        className="relative border-l border-gray-200 flex flex-col transition-all duration-300"
                        style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                      >
                        {/* 시간 슬롯 + 일정 */}
                        <div
                          className={`flex-1 relative ${isFocusDay ? 'bg-blue-50 bg-opacity-30' : ''}`}
                          style={{ height: `${SLOT_HEIGHT * 48}px` }}
                        >
                          {timeSlots.map((time, i) => (
                            <div
                              key={time}
                              className={`absolute w-full border-t border-gray-200 border-dashed ${
                                activeTimeSlot === time && isFocusDay ? 'bg-gray-300 bg-opacity-10' : ''
                              }`}
                              style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                              onClick={() => isFocusDay && handleTimeSlotClick(time)}
                            />
                          ))}

                          {/* 현재 시간 표시 */}
                          {date.toDateString() === new Date().toDateString() && (
                            <div
                              className="absolute w-full border-t-2 border-red-500 z-10"
                              style={{ top: `${getCurrentTimeLine()}px` }}
                            >
                              <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-500 rounded-full" />
                            </div>
                          )}

                          {/* 일정들 */}
                          {dateSchedules.map((s) => {
                            const top = calculateSlotPosition(s.start);
                            const bottom = calculateSlotPosition(s.end);
                            const height = bottom - top;
                            const tagTypeForItem = safeTagItems.find(item => item.tagName === s.tag)?.tagType || s.tagType;
                            const tagColor = getTagColor(tagTypeForItem);
                            const isDragging = dragging === s.id;

                            return (
                              <div
                                key={s.id}
                                className="absolute left-0 w-full px-1"
                                style={{ 
                                  top: `${top}px`, 
                                  height: `${height}px`,
                                  zIndex: isDragging ? 50 : 1
                                }}
                              >
                                <div 
                                  className={`h-full flex flex-col text-xs rounded-lg px-2 py-1 shadow ${tagColor.bg} ${tagColor.text} relative overflow-hidden cursor-move select-none ${
                                    isDragging ? 'opacity-50 ring-2 ring-blue-400' : 'hover:shadow-md'
                                  }`}
                                  onMouseDown={(e) => {
                                    if (e.button === 0) {
                                      handleDragStart(e, s.id);
                                    }
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, s.id)}
                                >
                                  {isFocusDay && (
                                    <>
                                      <div
                                        className="absolute top-0 left-0 right-0 h-3 bg-black bg-opacity-20 cursor-ns-resize rounded-t-lg z-20"
                                        onMouseDown={(e) => {
                                          if (e.button === 0) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleResizeStart(e, s.id, 'top');
                                          }
                                        }}
                                      />
                                      <div
                                        className="absolute bottom-0 left-0 right-0 h-3 bg-black bg-opacity-20 cursor-ns-resize rounded-b-lg z-20"
                                        onMouseDown={(e) => {
                                          if (e.button === 0) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleResizeStart(e, s.id, 'bottom');
                                          }
                                        }}
                                      />
                                    </>
                                  )}

                                  {/* 첫째줄: 체크박스 + 태그(라운드 네모칸) + 항목명 */}
                                  <div className="flex items-center gap-1 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={s.done}
                                      className="pointer-events-auto flex-shrink-0"
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (setSchedules && currentUser) {
                                          const updated = safeSchedules.map(item =>
                                            item.id === s.id ? { ...item, done: !item.done } : item
                                          );
                                          setSchedules(updated);
                                          
                                          // storage에도 반영
                                          saveUserCoreData(currentUser, {
                                            schedules: updated,
                                            tags: safeTags,
                                            tagItems: safeTagItems
                                          });
                                        }
                                      }}
                                    />
                                    {s.tag && (
                                      <span className="px-2 py-0.5 text-[10px] bg-white bg-opacity-30 rounded-md font-bold flex-shrink-0">
                                        {tagTypeForItem ? `${tagTypeForItem}` : s.tag}
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-bold truncate ${s.done ? "line-through opacity-60" : ""}`}>
                                      {s.tag ? s.tag : ''}
                                    </span>
                                  </div>

                                  {/* 둘째줄: 시간 표기 */}
                                  <div className="text-[12px] mb-1 opacity-80">
                                    {s.start} - {s.end}
                                  </div>

                                  {/* 셋째줄: 일정명 */}
                                  <div className={`text-[11px] font-bold mb-1 truncate ${s.done ? "line-through opacity-60" : ""}`}>
                                    {s.title}
                                  </div>

                                  {/* 넷째줄: 일정 내용 */}
                                  {s.description && (
                                    <div className="text-[9px] opacity-70 flex-1 overflow-hidden">
                                      <div className="line-clamp-2">
                                        {s.description}
                                      </div>
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
            </div>
          </div>
        </div>
        
        {/* 오른쪽: 입력 폼 */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-hidden p-4">
          <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold mt-2 mb-4">일정 추가</h2>
            
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-4">
                <input
                  type="text"
                  placeholder="일정 명을 적어주세요."
                  className="w-full bg-gray-50 border-0 border-b border-gray-200 px-2 py-2 mb-3 focus:outline-none focus:border-gray-400"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 relative">
                    <div className="flex items-center border rounded-md p-2 bg-white">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <select
                        className="ml-2 w-full bg-transparent border-0 focus:outline-none appearance-none"
                        value={startSlot || ""}
                        onChange={(e) => setStartSlot(e.target.value)}
                      >
                        {timeSlots.map(time => (
                          <option key={`start-${time}`} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex-1 relative">
                    <div className="flex items-center border rounded-md p-2 bg-white">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <select
                        className="ml-2 w-full bg-transparent border-0 focus:outline-none appearance-none"
                        value={form.end}
                        onChange={(e) => setForm({ ...form, end: e.target.value })}
                      >
                        {timeSlots
                          .filter((t) => !startSlot || parseTimeToMinutes(t) > parseTimeToMinutes(startSlot))
                          .map(time => (
                            <option key={`end-${time}`} value={time}>{time}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <textarea
                  placeholder="내용을 적어주세요"
                  className="w-full h-24 bg-white border rounded-md p-3 mb-3 focus:outline-none focus:border-gray-400 resize-none"
                  value={form.description || ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                ></textarea>
                
                {/* 반복 옵션 영역 */}
                <div className="mb-3">
                  <h3 className="font-medium mb-2">반복 설정</h3>
                  
                  <div className="flex gap-2 mb-2">
                    {/* 반복 횟수 */}
                    <select
                      className="flex-1 border rounded-md p-2 text-xs"
                      value={form.repeatCount}
                      onChange={(e) => setForm({ ...form, repeatCount: e.target.value })}
                    >
                      <option value="1">반복 없음</option>
                      {repeatOptions.map((count) => (
                        <option key={count} value={count}>
                          {count}번 반복
                        </option>
                      ))}
                    </select>

                    {/* 주기 설정 */}
                    <select
                      className="flex-1 border rounded-md p-2 text-xs"
                      value={form.interval}
                      onChange={(e) => setForm({ ...form, interval: e.target.value })}
                    >
                      {intervalOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 요일 선택 */}
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day, idx) => {
                      const selected = form.weekdays.includes(day);
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`w-7 h-7 rounded-full border text-xs font-medium transition ${
                            selected
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          onClick={() => handleWeekdaySelect(day)}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="font-medium mb-2">태그 선택</h3>
                  <div className="h-48 overflow-y-auto pr-1 border rounded-md p-3 bg-white">
                    {safeTagItems.map((item, idx) => {
                      const tagGroup = safeTags.find(t => t.tagType === item.tagType);
                      const tagColor = tagGroup ? tagGroup.color : { bg: "bg-gray-100", text: "text-gray-800" };
                      
                      return (
                        <div key={idx} className="flex items-center mb-2 last:mb-0">
                          <div className={`w-16 ${tagColor.bg} ${tagColor.text} px-2 py-1 rounded-l-md text-xs font-medium truncate`}>
                            {item.tagType}
                          </div>
                          <div 
                            className={`flex-1 ${tagColor.bg} ${tagColor.text} px-2 py-1 text-xs cursor-pointer hover:bg-opacity-80 ${selectedTagType === item.tagType && form.tag === item.tagName ? 'ring-1 ring-blue-400' : ''}`}
                            onClick={() => handleSelectTag(item.tagType, item.tagName)}
                          >
                            {item.tagName}
                          </div>
                          <button 
                            className="bg-red-100 text-red-500 rounded-r-md px-2 py-1 text-xs"
                            onClick={() => handleDeleteTagItem(item.tagType, item.tagName)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {safeTagItems.length === 0 && (
                      <div className="text-center text-gray-500 py-15 text-sm">
                        태그를 추가해주세요
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 mb-1">
                  <input
                    type="text"
                    placeholder="태그"
                    className="w-16 text-xs bg-white border rounded-l-md px-2 py-1 focus:outline-none focus:border-gray-400"
                    value={newTagType}
                    onChange={(e) => setNewTagType(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="항목 이름"
                    className="flex-1 text-xs bg-white border-y border-r-0 px-2 py-1 focus:outline-none focus:border-gray-400"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />
                  <button 
                    className="bg-gray-200 w-8 h-6 rounded-r-md flex items-center justify-center text-sm font-bold"
                    onClick={handleAddTag}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                className="w-full bg-green-100 text-center py-3 rounded-lg text-xl font-medium text-green-800"
                onClick={handleAdd}
              >
                일정 추가하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SimplifiedWeeklyCalendar(props) {
  return <WeeklyCalendar {...props} />;
}
