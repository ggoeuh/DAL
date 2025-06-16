import { useState, useRef, useEffect, useCallback, useMemo } from "react";

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

// ✨ 커스텀 훅: 캘린더 로직 (무한 루프 방지 최적화)
export const useWeeklyCalendarLogic = ({ 
  schedules = [], 
  setSchedules, 
  tags = [], 
  setTags, 
  tagItems = [], 
  setTagItems, 
  currentUser 
}) => {
  console.log('🔧 useWeeklyCalendarLogic 렌더링'); // 디버깅용

  // 안전한 배열 보장 - useMemo로 메모이제이션
  const safeSchedules = useMemo(() => Array.isArray(schedules) ? schedules : [], [schedules]);
  const safeTags = useMemo(() => Array.isArray(tags) ? tags : [], [tags]);
  const safeTagItems = useMemo(() => Array.isArray(tagItems) ? tagItems : [], [tagItems]);

  // 날짜 상태 관리 - 초기값만 함수로, 이후는 정적
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

  // 현재 시간 표시 라인 위치 계산 - 의존성 없는 순수 함수로
  const getCurrentTimeLine = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const slotPosition = (totalMinutes / 30) * SLOT_HEIGHT;
    return slotPosition;
  }, []); // 의존성 없음

  // 새 태그 타입에 색상 할당 - 최소한의 의존성
  const assignNewTagColor = useCallback((tagType) => {
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
  }, [safeTags.length]); // 길이만 의존

  // 포커스 날짜 변경 핸들러 - 최소한의 의존성
  const handleDayFocus = useCallback((dayIndex) => {
    setFocusedDayIndex(prev => {
      if (dayIndex === prev) return prev;
      
      const newVisibleDays = [];
      const focusPosition = 3;
      
      for (let i = 0; i < 5; i++) {
        const offset = i - focusPosition;
        const newIndex = (dayIndex + offset + 7) % 7;
        newVisibleDays.push(newIndex);
      }
      
      setVisibleDays(newVisibleDays);
      return dayIndex;
    });
  }, []); // 의존성 없음

  // 시간 슬롯 계산 헬퍼 함수 - 순수 함수
  const calculateSlotPosition = useCallback((time) => {
    const minutes = parseTimeToMinutes(time);
    const slotIndex = minutes / 30;
    return slotIndex * SLOT_HEIGHT;
  }, []); // 의존성 없음

  // ✨ 리사이즈 핸들러들 - setSchedules를 직접 사용하지 않음
  const handleResizeStart = useCallback((e, scheduleId, type) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(scheduleId);
    setResizeType(type);
  }, []);

  const handleResizeMove = useCallback((e) => {
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
  }, [resizing, resizeType, safeSchedules, setSchedules]);
  
  const handleResizeEnd = useCallback(() => {
    setResizing(null);
    setResizeType(null);
  }, []);

  // 태그 색상 가져오기 - 최소한의 의존성
  const getTagColor = useCallback((tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : { bg: "bg-gray-100", text: "text-gray-800" };
  }, [safeTags.length]); // 길이만 의존

  // 태그 총합 계산 - 깊은 비교 대신 길이만 체크
  const tagTotals = useMemo(() => {
    return calculateTagTotals(safeSchedules);
  }, [safeSchedules.length]); // 길이만 의존

  // 🚨 중요: 모든 함수와 값들을 안정적으로 반환
  return useMemo(() => ({
    // 상태들
    currentWeek,
    setCurrentWeek,
    focusedDayIndex,
    setFocusedDayIndex,
    visibleDays,
    setVisibleDays,
    timeSlots: TIME_SLOTS, // 상수 사용
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
    
    // 계산된 값들 - 안정적인 참조
    safeSchedules,
    safeTags,
    safeTagItems,
    tagTotals,
    repeatOptions: REPEAT_OPTIONS, // 상수 사용
    intervalOptions: INTERVAL_OPTIONS, // 상수 사용
    
    // 상수들
    SLOT_HEIGHT,
    DAYS_OF_WEEK,
    PASTEL_COLORS,
    
    // 유틸리티 함수들 - 순수 함수들
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
  }), [
    // 🚨 중요: 최소한의 의존성만 포함
    currentWeek,
    focusedDayIndex,
    visibleDays,
    form,
    startSlot,
    activeTimeSlot,
    resizing,
    resizeType,
    showOverlapMessage,
    contextMenu,
    copyingSchedule,
    newTagType,
    newTagName,
    selectedTagType,
    dragging,
    dragOffset,
    autoScrollTimer,
    safeSchedules,
    safeTags,
    safeTagItems,
    tagTotals,
    getCurrentTimeLine,
    assignNewTagColor,
    handleDayFocus,
    calculateSlotPosition,
    getTagColor,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  ]);
};
