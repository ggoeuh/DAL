import { useState, useRef, useEffect } from "react";

// 상수들을 파일 상단으로 완전히 분리
const SLOT_HEIGHT = 24;
const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

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

const REPEAT_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 2);
const INTERVAL_OPTIONS = [
  { value: "1", label: "매주" },
  { value: "2", label: "격주" },
  { value: "3", label: "3주마다" },
  { value: "4", label: "4주마다" }
];

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

// 유틸리티 함수들을 완전히 분리하여 매번 새로 생성되지 않도록 함
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

// ✨ 커스텀 훅: 캘린더 로직 (완전히 단순화)
export const useWeeklyCalendarLogic = ({ 
  schedules = [], 
  setSchedules, 
  tags = [], 
  setTags, 
  tagItems = [], 
  setTagItems, 
  currentUser 
}) => {
  console.log('🔧 useWeeklyCalendarLogic 렌더링 - 단순화 버전');

  // 안전한 배열 보장 - 단순 변수로 처리
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];

  // 날짜 상태 관리
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    return Array(7).fill().map((_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + i);
      return date;
    });
  });
  
  const [focusedDayIndex, setFocusedDayIndex] = useState(() => new Date().getDay());
  
  const [visibleDays, setVisibleDays] = useState(() => {
    const focusPosition = 3;
    const newVisibleDays = [];
    const currentFocusedDay = new Date().getDay();
    for (let i = 0; i < 5; i++) {
      const offset = i - focusPosition;
      const newIndex = (currentFocusedDay + offset + 7) % 7;
      newVisibleDays.push(newIndex);
    }
    return newVisibleDays;
  });

  // 폼 및 UI 상태들
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

  // 초기 스크롤 설정
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 12 * SLOT_HEIGHT;
    }
  }, []);

  // 🚨 핵심: 모든 함수들을 단순한 일반 함수로 정의 (useCallback 제거)
  const getCurrentTimeLine = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const slotPosition = (totalMinutes / 30) * SLOT_HEIGHT;
    return slotPosition;
  };

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

  const calculateSlotPosition = (time) => {
    const minutes = parseTimeToMinutes(time);
    const slotIndex = minutes / 30;
    return slotIndex * SLOT_HEIGHT;
  };

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

  const getTagColor = (tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : { bg: "bg-gray-100", text: "text-gray-800" };
  };

  // 태그 총합 계산 - 단순 계산으로 변경
  const tagTotals = calculateTagTotals(safeSchedules);

  // 🚨 중요: 단순한 객체 반환 (useMemo 완전 제거)
  return {
    // 상태들
    currentWeek,
    setCurrentWeek,
    focusedDayIndex,
    setFocusedDayIndex,
    visibleDays,
    setVisibleDays,
    timeSlots: TIME_SLOTS,
    form,
    setForm,
    startSlot,
    setStartSlot,
    activeTimeSlot,
    setActiveTimeSlot,
    resizing,
    resizeType,
    containerRef,
    showOverlapMessage,
    setShowOverlapMessage,
    contextMenu,
    setContextMenu,
    copyingSchedule,
    setCopyingSchedule,
    newTagType,
    setNewTagType,
    newTagName,
    setNewTagName,
    selectedTagType,
    setSelectedTagType,
    dragging,
    setDragging,
    dragOffset,
    setDragOffset,
    autoScrollTimer,
    setAutoScrollTimer,
    
    // 계산된 값들
    safeSchedules,
    safeTags,
    safeTagItems,
    tagTotals,
    repeatOptions: REPEAT_OPTIONS,
    intervalOptions: INTERVAL_OPTIONS,
    
    // 상수들
    SLOT_HEIGHT,
    DAYS_OF_WEEK,
    PASTEL_COLORS,
    
    // 유틸리티 함수들
    parseTimeToMinutes,
    minutesToTimeString,
    pixelToNearestTimeSlot,
    formatDate,
    getDayOfWeek,
    filterSchedulesByDate,
    calculateTagTotals,
    checkScheduleOverlap,
    getCurrentTimeLine,
    assignNewTagColor,
    handleDayFocus,
    calculateSlotPosition,
    getTagColor,
    
    // 이벤트 핸들러들
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  };
};
