import { useState, useRef, useEffect } from "react";
import { saveUserDataToDAL, loadUserDataFromDAL } from './utils/supabaseStorage.js';
import { useNavigate } from "react-router-dom";

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

// 커스텀 훅: 캘린더 로직
export const useWeeklyCalendarLogic = (props = {}) => {
  // props에서 필요한 값들 추출
  const { 
    currentUser = null,
    initialSchedules = [],
    initialTags = [],
    initialTagItems = [],
    initialMonthlyGoals = [],
    isServerBased = true, // 기본값을 서버 기반으로 설정
    enableAutoRefresh = true // 자동 새로고침 옵션
  } = props;
  
  const navigate = useNavigate();

  // 서버 상태 관리
  const [schedules, setSchedules] = useState(initialSchedules);
  const [monthlyGoals, setMonthlyGoals] = useState(initialMonthlyGoals);
  const [tags, setTags] = useState(initialTags);
  const [tagItems, setTagItems] = useState(initialTagItems);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // 안전한 데이터 접근을 위한 변수들
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];
  const safeMonthlyGoals = Array.isArray(monthlyGoals) ? monthlyGoals : [];

  // 서버에서 데이터 불러오기
  const loadDataFromServer = async (silent = false) => {
    if (!currentUser) {
      if (!silent) console.log('❌ currentUser가 없어서 서버 데이터를 로드하지 않습니다.');
      setIsLoading(false);
      return { success: false, error: 'No currentUser' };
    }

    try {
      if (!silent) setIsLoading(true);
      console.log('🔄 서버에서 사용자 데이터 불러오기 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        const serverData = result.data;
        
        setSchedules(serverData.schedules || []);
        setMonthlyGoals(serverData.monthlyGoals || []);
        setTags(serverData.tags || []);
        setTagItems(serverData.tagItems || []);
        setLastSyncTime(new Date());
        
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: serverData.schedules?.length || 0,
          monthlyGoals: serverData.monthlyGoals?.length || 0,
          tags: serverData.tags?.length || 0,
          tagItems: serverData.tagItems?.length || 0
        });
        
        return { success: true, data: serverData };
      } else {
        console.warn('⚠️ 서버 데이터 로드 실패 또는 빈 데이터:', result.error);
        // 서버에 데이터가 없는 경우 빈 배열로 초기화
        setSchedules([]);
        setMonthlyGoals([]);
        setTags([]);
        setTagItems([]);
        setLastSyncTime(new Date());
        
        return { success: true, data: null };
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 중 오류:', error);
      if (!silent) {
        console.error('서버 데이터를 불러오는 중 오류가 발생했습니다:', error.message);
      }
      return { success: false, error: error.message };
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // 서버에 데이터 저장하기
  const saveDataToServer = async (updatedData, silent = false) => {
    if (!currentUser) {
      if (!silent) console.log('❌ currentUser가 없어서 서버에 데이터를 저장하지 않습니다.');
      return { success: false, error: 'No currentUser' };
    }

    try {
      if (!silent) console.log('💾 서버에 데이터 저장 시작:', currentUser);
      
      const dataToSave = {
        schedules: updatedData.schedules || safeSchedules,
        monthlyGoals: updatedData.monthlyGoals || safeMonthlyGoals,
        tags: updatedData.tags || safeTags,
        tagItems: updatedData.tagItems || safeTagItems
      };

      await saveUserDataToDAL(currentUser, dataToSave);
      console.log('✅ 서버 데이터 저장 완료');
      setLastSyncTime(new Date());
      return { success: true };
    } catch (error) {
      console.error('❌ 서버 데이터 저장 중 오류:', error);
      if (!silent) {
        alert('서버에 데이터를 저장하는 중 오류가 발생했습니다: ' + error.message);
      }
      return { success: false, error: error.message };
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (isServerBased && currentUser) {
      console.log('🌐 서버 기반 모드 - 서버에서 데이터 로드');
      loadDataFromServer();
    } else {
      console.log('📦 props 기반 모드 - 전달받은 데이터 사용');
      setSchedules(initialSchedules);
      setTags(initialTags);
      setTagItems(initialTagItems);
      setMonthlyGoals(initialMonthlyGoals);
    }
  }, [currentUser, isServerBased]);

  // 페이지 포커스 시 자동 새로고침 (CalendarPage 패턴 적용)
  useEffect(() => {
    if (!isServerBased || !enableAutoRefresh || !currentUser) return;

    const handleFocus = () => {
      console.log('🔄 페이지 포커스 - 서버 데이터 새로고침');
      loadDataFromServer(true); // silent 모드로 새로고침
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, isServerBased, enableAutoRefresh]);

  // props 변경 시 로컬 상태 업데이트 (비서버 모드)
  useEffect(() => {
    if (!isServerBased) {
      setSchedules(initialSchedules);
      setTags(initialTags);
      setTagItems(initialTagItems);
      setMonthlyGoals(initialMonthlyGoals);
    }
  }, [initialSchedules, initialTags, initialTagItems, initialMonthlyGoals, isServerBased]);

  // 날짜 상태 관리
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
    
    const usedColors = safeTags.map(t => t.color).filter(color => color);
    const availableColors = PASTEL_COLORS.filter(
      color => !usedColors.some(used => used && used.bg === color.bg)
    );
    
    return availableColors.length > 0 
      ? availableColors[0] 
      : PASTEL_COLORS[safeTags.length % PASTEL_COLORS.length];
  };

  // 포커스 날짜 변경 핸들러
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
    if (!resizing || !containerRef.current) return;
    
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
          
          // 서버에 저장
          if (isServerBased && currentUser) {
            saveDataToServer({
              schedules: updatedSchedules,
              monthlyGoals: safeMonthlyGoals,
              tags: safeTags,
              tagItems: safeTagItems
            }, true); // silent 모드
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
          
          // 서버에 저장
          if (isServerBased && currentUser) {
            saveDataToServer({
              schedules: updatedSchedules,
              monthlyGoals: safeMonthlyGoals,
              tags: safeTags,
              tagItems: safeTagItems
            }, true); // silent 모드
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

  // 태그 색상 가져오기
  const getTagColor = (tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : { bg: "bg-gray-100", text: "text-gray-800" };
  };

  // 일정 추가/수정/삭제 헬퍼 함수들
  const addSchedule = async (newSchedule) => {
    const updatedSchedules = [...safeSchedules, newSchedule];
    setSchedules(updatedSchedules);
    
    if (isServerBased && currentUser) {
      return await saveDataToServer({
        schedules: updatedSchedules,
        monthlyGoals: safeMonthlyGoals,
        tags: safeTags,
        tagItems: safeTagItems
      });
    }
    return { success: true };
  };

  const updateSchedule = async (scheduleId, updatedData) => {
    const scheduleIndex = safeSchedules.findIndex(s => s.id === scheduleId);
    if (scheduleIndex === -1) return { success: false, error: 'Schedule not found' };
    
    const updatedSchedules = [...safeSchedules];
    updatedSchedules[scheduleIndex] = { ...updatedSchedules[scheduleIndex], ...updatedData };
    setSchedules(updatedSchedules);
    
    if (isServerBased && currentUser) {
      return await saveDataToServer({
        schedules: updatedSchedules,
        monthlyGoals: safeMonthlyGoals,
        tags: safeTags,
        tagItems: safeTagItems
      });
    }
    return { success: true };
  };

  const deleteSchedule = async (scheduleId) => {
    const updatedSchedules = safeSchedules.filter(s => s.id !== scheduleId);
    setSchedules(updatedSchedules);
    
    if (isServerBased && currentUser) {
      return await saveDataToServer({
        schedules: updatedSchedules,
        monthlyGoals: safeMonthlyGoals,
        tags: safeTags,
        tagItems: safeTagItems
      });
    }
    return { success: true };
  };

  return {
    // 상태들
    currentWeek,
    setCurrentWeek,
    focusedDayIndex,
    setFocusedDayIndex,
    visibleDays,
    setVisibleDays,
    timeSlots,
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
    isLoading,
    lastSyncTime,
    
    // 상태 설정 함수들
    setSchedules,
    setTags,
    setTagItems,
    setMonthlyGoals,
    
    // 계산된 값들
    safeSchedules,
    safeTags,
    safeTagItems,
    safeMonthlyGoals,
    tagTotals: calculateTagTotals(safeSchedules),
    repeatOptions,
    intervalOptions,
    
    // 서버 관련 함수들
    loadDataFromServer,
    saveDataToServer,
    
    // 일정 관리 함수들
    addSchedule,
    updateSchedule,
    deleteSchedule,
    
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
