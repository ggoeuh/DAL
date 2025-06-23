import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

function checkScheduleOverlap(schedules, newSchedule) {
  const normalizeDate = (date) =>
    typeof date === "string"
      ? date
      : new Date(date).toLocaleDateString("sv-SE"); // ✅ 로컬 기준 안전 변환

  const newDate = normalizeDate(newSchedule.date);

  return schedules.some((s) => {
    const sDate = normalizeDate(s.date);

    if (sDate !== newDate) return false;

    const startA = parseTimeToMinutes(s.start);
    const endA = parseTimeToMinutes(s.end);
    const startB = parseTimeToMinutes(newSchedule.start);
    const endB = parseTimeToMinutes(newSchedule.end);

    // 시간 겹치는지 확인
    const overlap =
      (startA < endB && endA > startB) ||
      (startB < endA && endB > startA);

    if (overlap) {
      console.log("⛔️ 중복 인식됨:");
      console.log("기존 일정:", s);
      console.log("추가 일정:", newSchedule);
    }

    return overlap;
  });
}


// 커스텀 훅: 캘린더 로직 (최적화됨)
export const useWeeklyCalendarLogic = (props = {}) => {
  // props에서 필요한 값들 추출
  const { 
    currentUser = null,
    initialSchedules = [],
    initialTags = [],
    initialTagItems = [],
    initialMonthlyGoals = [],
    isServerBased = true,
    enableAutoRefresh = false, // ✅ 기본값을 false로 변경 (필요시에만 활성화)
    initialDate = null
  } = props;
  
  const navigate = useNavigate();

  // ✅ 서버 상태 관리 (안정적인 초기값 설정)
  const [schedules, setSchedules] = useState(initialSchedules);
  const [monthlyGoals, setMonthlyGoals] = useState(initialMonthlyGoals);
  const [tags, setTags] = useState(initialTags);
  const [tagItems, setTagItems] = useState(initialTagItems);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // ✅ 저장 상태 추가
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // ✅ 데이터 로딩 완료 상태 추가
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // 안전한 데이터 접근을 위한 변수들 - useMemo로 최적화
  const safeSchedules = useMemo(() => Array.isArray(schedules) ? schedules : [], [schedules]);
  const safeTags = useMemo(() => Array.isArray(tags) ? tags : [], [tags]);
  const safeTagItems = useMemo(() => Array.isArray(tagItems) ? tagItems : [], [tagItems]);
  const safeMonthlyGoals = useMemo(() => Array.isArray(monthlyGoals) ? monthlyGoals : [], [monthlyGoals]);

  // ✅ 초기 날짜 계산 함수 - useMemo로 최적화
  const getInitialDate = useMemo(() => {
    if (initialDate) {
      const targetDate = new Date(initialDate);
      console.log('✅ URL에서 받은 날짜:', initialDate, '→', targetDate.toISOString().split('T')[0]);
      return targetDate;
    }
    return new Date();
  }, [initialDate]);

  // ✅ 날짜 상태 관리 - useMemo로 최적화
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = getInitialDate;
    return Array(7).fill().map((_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + i);
      return date;
    });
  });

  // ✅ 초기 포커스 날짜 인덱스 - useMemo로 최적화
  const [focusedDayIndex, setFocusedDayIndex] = useState(() => {
    if (initialDate) {
      const targetDate = new Date(initialDate);
      return targetDate.getDay();
    }
    return new Date().getDay();
  });
  
  // ✅ visibleDays 초기값 - useMemo로 최적화
  const [visibleDays, setVisibleDays] = useState(() => {
    const baseDate = getInitialDate;
    const visibleDates = [];
    for (let i = -2; i <= 2; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      visibleDates.push(date);
    }
    return visibleDates;
  });
  
  // ✅ 시간 슬롯 - useMemo로 최적화
  const timeSlots = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => {
      const hour = Math.floor(i / 2);
      const minute = i % 2 === 0 ? "00" : "30";
      return `${hour.toString().padStart(2, "0")}:${minute}`;
    });
  }, []);

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
  
  // ✅ 상수들 - useMemo로 최적화
  const repeatOptions = useMemo(() => Array.from({ length: 15 }, (_, i) => i + 2), []);
  const intervalOptions = useMemo(() => [
    { value: "1", label: "매주" },
    { value: "2", label: "격주" },
    { value: "3", label: "3주마다" },
    { value: "4", label: "4주마다" }
  ], []);

  // ✅ 마지막 저장 시간을 추적하여 중복 저장 방지
  const lastSaveTimeRef = useRef(0);

  // ✅ initialDate 변경 시 주간 뷰 업데이트 - 의존성 최적화
  useEffect(() => {
    if (initialDate) {
      const targetDate = new Date(initialDate);
      
      console.log('🎯 initialDate 변경 감지:', {
        initialDate,
        targetDate: targetDate.toISOString().split('T')[0],
        dayOfWeek: targetDate.getDay()
      });
      
      // currentWeek 업데이트
      const startOfWeek = new Date(targetDate);
      startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
      
      const newWeek = Array(7).fill().map((_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        return date;
      });
      
      setCurrentWeek(newWeek);
      setFocusedDayIndex(targetDate.getDay());
      
      // visibleDays 업데이트
      const newVisibleDays = [];
      for (let i = -2; i <= 2; i++) {
        const date = new Date(targetDate);
        date.setDate(targetDate.getDate() + i);
        newVisibleDays.push(date);
      }
      setVisibleDays(newVisibleDays);
      
      console.log('✅ initialDate로 주간뷰 설정 완료');
    }
  }, [initialDate]);

  // ✅ 서버에서 데이터 불러오기 - 중복 호출 방지 개선
  const loadDataFromServer = useCallback(async (forceRefresh = false) => {
    if (!currentUser) {
      console.log('❌ currentUser가 없어서 서버 데이터를 로드하지 않습니다.');
      setIsLoading(false);
      return { success: false, error: 'No currentUser' };
    }

    // ✅ 이미 로딩 중이거나, 초기 로드가 완료되었고 강제 새로고침이 아닌 경우 스킵
    if (isLoading || (isInitialLoadComplete && !forceRefresh)) {
      console.log('⏭️ 로딩 스킵 (이미 로딩 중이거나 완료됨)');
      return { success: false, error: 'Already loading or loaded' };
    }

    try {
      setIsLoading(true);
      console.log('🔄 서버에서 사용자 데이터 불러오기 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        const serverData = result.data;
        
        setSchedules(serverData.schedules || []);
        setMonthlyGoals(serverData.monthlyGoals || []);
        setTags(serverData.tags || []);
        setTagItems(serverData.tagItems || []);
        setLastSyncTime(new Date());
        setIsInitialLoadComplete(true); // ✅ 초기 로드 완료 표시
        
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: serverData.schedules?.length || 0,
          monthlyGoals: serverData.monthlyGoals?.length || 0,
          tags: serverData.tags?.length || 0,
          tagItems: serverData.tagItems?.length || 0
        });
        
        return { success: true, data: serverData };
      } else {
        console.warn('⚠️ 서버 데이터 로드 실패 또는 빈 데이터:', result.error);
        setSchedules([]);
        setMonthlyGoals([]);
        setTags([]);
        setTagItems([]);
        setLastSyncTime(new Date());
        setIsInitialLoadComplete(true); // ✅ 빈 데이터라도 초기 로드 완료 표시
        
        return { success: true, data: null };
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 중 오류:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isLoading, isInitialLoadComplete]);

  // ✅ 서버에 데이터 저장하기 - 중복 저장 방지 개선
  const saveDataToServer = useCallback(async (updatedData, options = {}) => {
    const { silent = false, debounceMs = 1000 } = options;
    
    if (!currentUser) {
      if (!silent) console.log('❌ currentUser가 없어서 서버에 데이터를 저장하지 않습니다.');
      return { success: false, error: 'No currentUser' };
    }

    // ✅ 너무 자주 저장하는 것 방지 (디바운싱)
    const now = Date.now();
    if (now - lastSaveTimeRef.current < debounceMs) {
      console.log('⏭️ 저장 스킵 (디바운싱)');
      return { success: false, error: 'Debounced' };
    }

    // ✅ 이미 저장 중인 경우 스킵
    if (isSaving) {
      console.log('⏭️ 저장 스킵 (이미 저장 중)');
      return { success: false, error: 'Already saving' };
    }

    try {
      setIsSaving(true);
      lastSaveTimeRef.current = now;
      
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
    } finally {
      setIsSaving(false);
    }
  }, [currentUser, safeSchedules, safeMonthlyGoals, safeTags, safeTagItems, isSaving]);

  // ✅ 초기 데이터 로드 - 한 번만 실행되도록 최적화
  useEffect(() => {
    if (isServerBased && currentUser && !isInitialLoadComplete) {
      console.log('🌐 서버 기반 모드 - 서버에서 데이터 로드 (최초 1회)');
      loadDataFromServer(true); // 강제 새로고침으로 초기 로드
    } else if (!isServerBased) {
      console.log('📦 props 기반 모드 - 전달받은 데이터 사용');
      setSchedules(initialSchedules);
      setTags(initialTags);
      setTagItems(initialTagItems);
      setMonthlyGoals(initialMonthlyGoals);
      setIsInitialLoadComplete(true);
    }
  }, [currentUser, isServerBased, isInitialLoadComplete]); // ✅ 불필요한 의존성 제거

  // ✅ 페이지 포커스 시 자동 새로고침 - 선택적 활성화
  useEffect(() => {
    if (!isServerBased || !enableAutoRefresh || !currentUser || !isInitialLoadComplete) return;

    let debounceTimer = null;
    let lastFocusTime = 0;

    const handleFocus = () => {
      const now = Date.now();
      // ✅ 5초 이상 간격이 있을 때만 새로고침
      if (now - lastFocusTime < 5000) return;
      
      lastFocusTime = now;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('🔄 페이지 포커스 - 서버 데이터 새로고침');
        loadDataFromServer(true);
      }, 2000); // 2초 디바운싱
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, isServerBased, enableAutoRefresh, isInitialLoadComplete, loadDataFromServer]);

  // ✅ props 변경 시 로컬 상태 업데이트 - 깊은 비교로 불필요한 업데이트 방지
  const prevInitialDataRef = useRef({
    schedules: null,
    tags: null,
    tagItems: null,
    monthlyGoals: null
  });

  useEffect(() => {
    if (!isServerBased) {
      const prev = prevInitialDataRef.current;
      
      if (JSON.stringify(prev.schedules) !== JSON.stringify(initialSchedules)) {
        prev.schedules = initialSchedules;
        setSchedules(initialSchedules);
      }
      if (JSON.stringify(prev.tags) !== JSON.stringify(initialTags)) {
        prev.tags = initialTags;
        setTags(initialTags);
      }
      if (JSON.stringify(prev.tagItems) !== JSON.stringify(initialTagItems)) {
        prev.tagItems = initialTagItems;
        setTagItems(initialTagItems);
      }
      if (JSON.stringify(prev.monthlyGoals) !== JSON.stringify(initialMonthlyGoals)) {
        prev.monthlyGoals = initialMonthlyGoals;
        setMonthlyGoals(initialMonthlyGoals);
      }
    }
  }, [initialSchedules, initialTags, initialTagItems, initialMonthlyGoals, isServerBased]);

  // 초기 스크롤 설정
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 12 * SLOT_HEIGHT;
    }
  }, []);

  // 현재 시간 표시 라인 위치 계산
  const getCurrentTimeLine = useCallback(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const slotPosition = (totalMinutes / 30) * SLOT_HEIGHT;
    return slotPosition;
  }, []);

  // 새 태그 타입에 색상 할당
  const assignNewTagColor = useCallback((tagType) => {
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
  }, [safeTags]);

  // 포커스 날짜 변경 핸들러
  const handleDayFocus = useCallback((clickedDate) => {
    const newVisibleDays = [];
    for (let i = -2; i <= 2; i++) {
      const date = new Date(clickedDate);
      date.setDate(clickedDate.getDate() + i);
      newVisibleDays.push(date);
    }
    
    setVisibleDays(newVisibleDays);
    setFocusedDayIndex(2);
    
    const startOfWeek = new Date(clickedDate);
    startOfWeek.setDate(clickedDate.getDate() - clickedDate.getDay());
    
    const newWeek = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      newWeek.push(date);
    }
    setCurrentWeek(newWeek);
  }, []);

  // 시간 슬롯 계산 헬퍼 함수
  const calculateSlotPosition = useCallback((time) => {
    const minutes = parseTimeToMinutes(time);
    const slotIndex = minutes / 30;
    return slotIndex * SLOT_HEIGHT;
  }, []);

  // ✅ 리사이즈 핸들러들 - 저장 최적화
  const handleResizeStart = useCallback((e, scheduleId, type) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(scheduleId);
    setResizeType(type);
  }, []);

  const handleResizeMove = useCallback((e) => {
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
          
          // ✅ 리사이즈 중에는 저장하지 않음 (handleResizeEnd에서 처리)
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
          
          // ✅ 리사이즈 중에는 저장하지 않음
        } else {
          setShowOverlapMessage(true);
          setTimeout(() => setShowOverlapMessage(false), 3000);
        }
      }
    }
  }, [resizing, resizeType, safeSchedules]);
  
  const handleResizeEnd = useCallback(async () => {
    if (resizing && isServerBased && currentUser) {
      // ✅ 리사이즈 완료 시에만 저장
      await saveDataToServer({
        schedules: safeSchedules,
        monthlyGoals: safeMonthlyGoals,
        tags: safeTags,
        tagItems: safeTagItems
      }, { silent: true, debounceMs: 500 });
    }
    
    setResizing(null);
    setResizeType(null);
  }, [resizing, isServerBased, currentUser, safeSchedules, safeMonthlyGoals, safeTags, safeTagItems, saveDataToServer]);

  // 태그 색상 가져오기
  const getTagColor = useCallback((tagType) => {
    const tag = safeTags.find(t => t.tagType === tagType);
    return tag ? tag.color : { bg: "bg-gray-100", text: "text-gray-800" };
  }, [safeTags]);

  // ✅ 일정 추가/수정/삭제 헬퍼 함수들 - 즉시 저장
  const addSchedule = useCallback(async (newSchedule) => {
    const updatedSchedules = [...safeSchedules, newSchedule];
    setSchedules(updatedSchedules);
    
    if (isServerBased && currentUser) {
      return await saveDataToServer({
        schedules: updatedSchedules,
        monthlyGoals: safeMonthlyGoals,
        tags: safeTags,
        tagItems: safeTagItems
      }, { debounceMs: 0 }); // 즉시 저장
    }
    return { success: true };
  }, [safeSchedules, safeMonthlyGoals, safeTags, safeTagItems, isServerBased, currentUser, saveDataToServer]);

  const updateSchedule = useCallback(async (scheduleId, updatedData) => {
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
      }, { debounceMs: 0 }); // 즉시 저장
    }
    return { success: true };
  }, [safeSchedules, safeMonthlyGoals, safeTags, safeTagItems, isServerBased, currentUser, saveDataToServer]);

  const deleteSchedule = useCallback(async (scheduleId) => {
    const updatedSchedules = safeSchedules.filter(s => s.id !== scheduleId);
    setSchedules(updatedSchedules);
    
    if (isServerBased && currentUser) {
      return await saveDataToServer({
        schedules: updatedSchedules,
        monthlyGoals: safeMonthlyGoals,
        tags: safeTags,
        tagItems: safeTagItems
      }, { debounceMs: 0 }); // 즉시 저장
    }
    return { success: true };
  }, [safeSchedules, safeMonthlyGoals, safeTags, safeTagItems, isServerBased, currentUser, saveDataToServer]);

  // ✅ 태그 관련 데이터 계산 - useMemo로 최적화
  const tagTotals = useMemo(() => calculateTagTotals(safeSchedules), [safeSchedules]);

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
    isSaving, // ✅ 저장 상태 추가
    lastSyncTime,
    isInitialLoadComplete, // ✅ 초기 로드 완료 상태 추가
    
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
    tagTotals,
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
