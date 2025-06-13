import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveUserDataToDAL } from './utils/supabaseStorage.js';

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

  // 날짜 상태 관리 - 원본과 동일하게 7일만 담기
  const today = new Date();
  const [currentWeek, setCurrentWeek] = useState(
    Array(7).fill().map((_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + i);
      return date;
    })
  );
  const [focusedDayIndex, setFocusedDayIndex] = useState(today.getDay());
  
  const [visibleDays, setVisibleDays] = useState(() => {
    const focusPosition = 3;
    const newVisibleDays = [];
    for (let i = 0; i < 5; i++) {
      const offset = i - focusPosition;
      const newIndex = (focusedDayIndex + offset + 7) % 7;
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

  // 포커스 날짜 변경 핸들러 - 원본과 동일
  const handleDayFocus = (dayIndex) => {
    if (dayIndex === focusedDayIndex) return;
    
    setFocusedDayIndex(dayIndex);
    
    const newVisibleDays = [];
    const focusPosition = 3;
    
    for (let i = 0; i < 5; i++) {
      const offset = i - focusPosition;
      const newIndex = (dayIndex + offset + 7) % 7;
      newVisibleDays.push(newIndex);
    }
    
    setVisibleDays(newVisibleDays);
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
            saveUserDataToDAL(currentUser, {
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
            saveUserDataToDAL(currentUser, {
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
      saveUserDataToDAL(currentUser, {
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
          saveUserDataToDAL(currentUser, {
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
  
  const handleDeleteTagItem = (tagType, tagName) => {
    if (setTagItems && currentUser) {
      const updatedTagItems = safeTagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName));
      setTagItems(updatedTagItems);
      
      // storage에도 반영
      saveUserDataToDAL(currentUser, {
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

  // 주간 네비게이션 - 원본과 동일하게 currentWeek 전체를 7일씩 이동
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
