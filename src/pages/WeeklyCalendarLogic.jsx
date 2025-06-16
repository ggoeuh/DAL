import { useState, useRef, useEffect, useMemo, useCallback } from "react";

// === 상수 ===
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

// === 유틸리티 함수 ===
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
  return minutesToTimeString(slotIndex * 30);
};

const formatDate = (date) => date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

const getDayOfWeek = (date) => DAYS_OF_WEEK[date.getDay()];

const filterSchedulesByDate = (schedules, date) => {
  const dateString = date.toISOString().split("T")[0];
  return schedules.filter(schedule => schedule.date === dateString);
};

const calculateTagTotals = (schedules) => {
  const totals = {};

  schedules.forEach(schedule => {
    const tagType = schedule.tagType || "기타";
    if (!totals[tagType]) totals[tagType] = 0;

    const duration = parseTimeToMinutes(schedule.end) - parseTimeToMinutes(schedule.start);
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
  const filtered = schedules.filter(s => s.date === newSchedule.date && s.id !== newSchedule.id);
  const newStart = parseTimeToMinutes(newSchedule.start);
  const newEnd = parseTimeToMinutes(newSchedule.end);

  return filtered.some(s => {
    const start = parseTimeToMinutes(s.start);
    const end = parseTimeToMinutes(s.end);
    return (
      (newStart >= start && newStart < end) ||
      (newEnd > start && newEnd <= end) ||
      (newStart <= start && newEnd >= end)
    );
  });
};

// === 🛡 안전한 schedule 생성기 ===
const createSafeSchedules = (rawSchedules) => {
  if (!Array.isArray(rawSchedules)) return [];

  const seen = new Set();
  return rawSchedules
    .filter(s => s && s.id && typeof s.id === "string")
    .filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .map(s => ({
      id: String(s.id),
      title: s.title || "제목 없음",
      start: s.start || "09:00",
      end: s.end || "10:00",
      date: s.date || new Date().toISOString().split("T")[0],
      tag: s.tag || "",
      tagType: s.tagType || "",
      description: s.description || "",
      done: Boolean(s.done),
      ...s
    }));
};

// === 메인 훅 ===
export const useWeeklyCalendarLogic = ({
  schedules = [],
  setSchedules: externalSetSchedules,
  tags = [],
  setTags,
  tagItems = [],
  setTagItems,
  currentUser
}) => {
  const [rawSchedules, setRawSchedules] = useState(schedules);
  const safeSchedules = useMemo(() => createSafeSchedules(rawSchedules), [rawSchedules]);

  const setSchedules = useCallback((newSchedules) => {
    setRawSchedules(newSchedules);
    externalSetSchedules?.(newSchedules); // 외부 상태도 업데이트
  }, [externalSetSchedules]);

  // === 상태 ===
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - today.getDay() + i);
      return d;
    });
  });

  const [focusedDayIndex, setFocusedDayIndex] = useState(() => new Date().getDay());

  const [visibleDays, setVisibleDays] = useState(() => {
    const pos = 3;
    const day = new Date().getDay();
    return Array.from({ length: 5 }, (_, i) => (day + i - pos + 7) % 7);
  });

  const [form, setForm] = useState({
    title: "", end: "07:00", description: "", tag: "",
    repeatCount: "1", interval: "1", weekdays: []
  });
  const [startSlot, setStartSlot] = useState("07:00");
  const [activeTimeSlot, setActiveTimeSlot] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [resizeType, setResizeType] = useState(null);
  const [showOverlapMessage, setShowOverlapMessage] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, scheduleId: null });
  const [copyingSchedule, setCopyingSchedule] = useState(null);
  const [newTagType, setNewTagType] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagType, setSelectedTagType] = useState("");
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [autoScrollTimer, setAutoScrollTimer] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 12 * SLOT_HEIGHT;
  }, []);

  const getCurrentTimeLine = () => {
    const now = new Date();
    return ((now.getHours() * 60 + now.getMinutes()) / 30) * SLOT_HEIGHT;
  };

  const assignNewTagColor = (tagType) => {
    const usedColors = tags.map(t => t.color?.bg);
    const available = PASTEL_COLORS.filter(c => !usedColors.includes(c.bg));
    return available[0] || PASTEL_COLORS[tags.length % PASTEL_COLORS.length];
  };

  const handleDayFocus = (dayIndex) => {
    if (dayIndex === focusedDayIndex) return;
    setFocusedDayIndex(dayIndex);
    setVisibleDays(Array.from({ length: 5 }, (_, i) => (dayIndex + i - 3 + 7) % 7));
  };

  const calculateSlotPosition = (time) => (parseTimeToMinutes(time) / 30) * SLOT_HEIGHT;

  const handleResizeStart = (e, scheduleId, type) => {
    e.preventDefault(); e.stopPropagation();
    setResizing(scheduleId);
    setResizeType(type);
  };

  const handleResizeMove = (e) => {
    if (!resizing || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + containerRef.current.scrollTop;

    const idx = safeSchedules.findIndex(s => s.id === resizing);
    if (idx === -1) return;

    const s = safeSchedules[idx];
    const updated = [...safeSchedules];

    if (resizeType === "top") {
      const newStart = pixelToNearestTimeSlot(relativeY);
      if (parseTimeToMinutes(newStart) < parseTimeToMinutes(s.end)) {
        const updatedSchedule = { ...s, start: newStart };
        if (!checkScheduleOverlap(safeSchedules, updatedSchedule)) {
          updated[idx] = updatedSchedule;
          setSchedules(updated);
        } else showTempMessage();
      }
    }

    if (resizeType === "bottom") {
      const newEnd = pixelToNearestTimeSlot(relativeY);
      if (parseTimeToMinutes(newEnd) > parseTimeToMinutes(s.start)) {
        const updatedSchedule = { ...s, end: newEnd };
        if (!checkScheduleOverlap(safeSchedules, updatedSchedule)) {
          updated[idx] = updatedSchedule;
          setSchedules(updated);
        } else showTempMessage();
      }
    }
  };

  const showTempMessage = () => {
    setShowOverlapMessage(true);
    setTimeout(() => setShowOverlapMessage(false), 3000);
  };

  const handleResizeEnd = () => {
    setResizing(null);
    setResizeType(null);
  };

  const getTagColor = (tagType) => {
    const tag = tags.find(t => t.tagType === tagType);
    return tag?.color || { bg: "bg-gray-100", text: "text-gray-800" };
  };

  const tagTotals = calculateTagTotals(safeSchedules);

  return {
    currentWeek, setCurrentWeek,
    focusedDayIndex, setFocusedDayIndex,
    visibleDays, setVisibleDays,
    timeSlots: TIME_SLOTS,
    form, setForm,
    startSlot, setStartSlot,
    activeTimeSlot, setActiveTimeSlot,
    resizing, resizeType,
    containerRef,
    showOverlapMessage, setShowOverlapMessage,
    contextMenu, setContextMenu,
    copyingSchedule, setCopyingSchedule,
    newTagType, setNewTagType,
    newTagName, setNewTagName,
    selectedTagType, setSelectedTagType,
    dragging, setDragging,
    dragOffset, setDragOffset,
    autoScrollTimer, setAutoScrollTimer,

    // 📦 schedule 데이터
    safeSchedules,
    schedules: rawSchedules,
    setSchedules,

    // 📦 기타
    safeTags: tags,
    setTags,
    safeTagItems: tagItems,
    setTagItems,

    tagTotals,
    repeatOptions: REPEAT_OPTIONS,
    intervalOptions: INTERVAL_OPTIONS,

    SLOT_HEIGHT,
    DAYS_OF_WEEK,
    PASTEL_COLORS,

    // 함수들
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
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    getTagColor
  };
};
