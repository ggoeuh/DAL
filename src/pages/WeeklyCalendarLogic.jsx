import { useState, useRef, useEffect } from "react";
import { saveUserDataToDAL, loadUserDataFromDAL } from './utils/supabaseStorage.js';

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

const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":" ).map(Number);
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

const formatDate = (date) => date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });

const getDayOfWeek = (date) => DAYS_OF_WEEK[date.getDay()];

const filterSchedulesByDate = (schedules, date) => {
  const dateString = date.toISOString().split("T")[0];
  return (schedules || []).filter(schedule => schedule.date === dateString);
};

const calculateTagTotals = (schedules) => {
  if (!Array.isArray(schedules)) return {};
  const totals = {};
  schedules.forEach(schedule => {
    const tagType = schedule.tagType || "기타";
    if (!totals[tagType]) totals[tagType] = 0;
    const startMinutes = parseTimeToMinutes(schedule.start);
    const endMinutes = parseTimeToMinutes(schedule.end);
    totals[tagType] += endMinutes - startMinutes;
  });
  Object.keys(totals).forEach(key => {
    const hours = Math.floor(totals[key] / 60);
    const minutes = totals[key] % 60;
    totals[key] = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  });
  return totals;
};

const checkScheduleOverlap = (schedules, newSchedule) => {
  const filtered = (schedules || []).filter(s => s.date === newSchedule.date && s.id !== newSchedule.id);
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

export const useWeeklyCalendarLogic = ({ currentUser }) => {
  const [schedules, setSchedules] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(null);

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
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, scheduleId: null });
  const [copyingSchedule, setCopyingSchedule] = useState(null);
  const [newTagType, setNewTagType] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagType, setSelectedTagType] = useState("");
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [autoScrollTimer, setAutoScrollTimer] = useState(null);

  useEffect(() => {
    const loadDataFromServer = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const result = await loadUserDataFromDAL(currentUser);
        if (result.success && result.data) {
          setSchedules(result.data.schedules || []);
          setMonthlyGoals(result.data.monthlyGoals || []);
          setTags(result.data.tags || []);
          setTagItems(result.data.tagItems || []);
          setLastSyncTime(new Date());
        } else {
          setSchedules([]);
          setMonthlyGoals([]);
          setTags([]);
          setTagItems([]);
          setLastSyncTime(new Date());
        }
      } catch (e) {
        console.error("서버 로드 오류:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadDataFromServer();
  }, [currentUser]);

  const today = new Date();
  const [currentWeek, setCurrentWeek] = useState(Array(7).fill().map((_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + i);
    return date;
  }));
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
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  });

  return {
    schedules,
    setSchedules,
    monthlyGoals,
    setMonthlyGoals,
    tags,
    setTags,
    tagItems,
    setTagItems,
    isLoading,
    lastSyncTime,
    form,
    setForm,
    startSlot,
    setStartSlot,
    activeTimeSlot,
    setActiveTimeSlot,
    resizing,
    setResizing,
    resizeType,
    setResizeType,
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
    currentWeek,
    setCurrentWeek,
    focusedDayIndex,
    setFocusedDayIndex,
    visibleDays,
    setVisibleDays,
    timeSlots,
    SLOT_HEIGHT,
    DAYS_OF_WEEK,
    PASTEL_COLORS,
    parseTimeToMinutes,
    minutesToTimeString,
    pixelToNearestTimeSlot,
    formatDate,
    getDayOfWeek,
    filterSchedulesByDate,
    calculateTagTotals,
    checkScheduleOverlap
  };
};
