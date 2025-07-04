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

// 🔧 수정된 픽셀을 시간으로 변환하는 함수
const pixelToNearestTimeSlot = (pixelPosition) => {
  // 음수 방지
  const safePixelPosition = Math.max(0, pixelPosition);
  
  // 30분 단위로 스냅
  const slotIndex = Math.round(safePixelPosition / SLOT_HEIGHT);
  
  // 24시간을 넘지 않도록 제한 (48 슬롯 = 24시간)
  const limitedSlotIndex = Math.min(47, slotIndex);
  
  const totalMinutes = limitedSlotIndex * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  console.log('🕐 픽셀 → 시간 변환:', {
    픽셀: pixelPosition,
    안전픽셀: safePixelPosition,
    슬롯인덱스: slotIndex,
    제한슬롯: limitedSlotIndex,
    총분: totalMinutes,
    시간: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  });
  
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
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

// ✅ 문제 1 해결: 월별 태그 시간 계산 함수 수정
const calculateTagTotals = (schedules, targetMonth = null) => {
  const totals = {};
  
  // 현재 주에 포함된 월을 기준으로 필터링
  const filteredSchedules = targetMonth 
    ? schedules.filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        const scheduleMonth = scheduleDate.getMonth() + 1; // getMonth()는 0부터 시작
        const scheduleYear = scheduleDate.getFullYear();
        return scheduleMonth === targetMonth.month && scheduleYear === targetMonth.year;
      })
    : schedules;
  
  filteredSchedules.forEach(schedule => {
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

// 🔧 수정된 겹침 검사 함수 - 더 정확한 로직
const checkScheduleOverlap = (schedules, newSchedule) => {
  // 자기 자신은 제외하고 같은 날짜의 일정들만 필터링
  const filtered = schedules.filter(s => 
    s.date === newSchedule.date && s.id !== newSchedule.id
  );
  
  console.log('🔍 겹침 검사:', {
    newSchedule: {
      id: newSchedule.id,
      date: newSchedule.date,
      start: newSchedule.start,
      end: newSchedule.end,
      title: newSchedule.title
    },
    existingSchedules: filtered.map(s => ({
      id: s.id,
      start: s.start,
      end: s.end,
      title: s.title
    }))
  });
  
  const newStart = parseTimeToMinutes(newSchedule.start);
  const newEnd = parseTimeToMinutes(newSchedule.end);
  
  const conflictingSchedule = filtered.find(s => {
    const existingStart = parseTimeToMinutes(s.start);
    const existingEnd = parseTimeToMinutes(s.end);
    
    const hasOverlap = (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    );
    
    console.log(`📊 겹침 검사 상세: ${s.title}`, {
      existing: `${s.start}(${existingStart}) - ${s.end}(${existingEnd})`,
      new: `${newSchedule.start}(${newStart}) - ${newSchedule.end}(${newEnd})`,
      hasOverlap
    });
    
    return hasOverlap;
  });
  
  if (conflictingSchedule) {
    console.log('❌ 겹침 발견:', conflictingSchedule.title);
    return true;
  }
  
  console.log('✅ 겹침 없음');
  return false;
};

// ✅ 문제 3 해결: 요일 문자열을 요일 인덱스로 변환하는 함수 추가
const getDayIndexFromKoreanDay = (koreanDay) => {
  const dayMap = {
    "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6
  };
  const result = dayMap[koreanDay] !== undefined ? dayMap[koreanDay] : -1;
  console.log(`🔍 getDayIndexFromKoreanDay: "${koreanDay}" → ${result}`);
  return result;
};

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
    enableAutoRefresh = false,
    initialDate = null
  } = props;
  
  const navigate = useNavigate();

  // ✅ 서버 상태 관리 (안정적인 초기값 설정)
  const [schedules, setSchedules] = useState(initialSchedules);
  const [monthlyGoals, setMonthlyGoals] = useState(initialMonthlyGoals);
  const [tags, setTags] = useState(initialTags);
  const [tagItems, setTagItems] = useState(initialTagItems);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
        setIsInitialLoadComplete(true);
        
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
        setIsInitialLoadComplete(true);
        
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
  }, [currentUser, isServerBased, isInitialLoadComplete]);

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

  // ✅ 수정된 포커스 날짜 변경 핸들러
  const handleDayFocus = useCallback((clickedDate) => {
    const newVisibleDays = [];
    for (let i = -2; i <= 2; i++) {
      const date = new Date(clickedDate);
      date.setDate(clickedDate.getDate() + i);
      newVisibleDays.push(date);
    }
    
    setVisibleDays(newVisibleDays);
    
    // ✅ 수정: 클릭한 날짜의 실제 요일을 계산하여 설정
    const clickedDayOfWeek = clickedDate.getDay();
    setFocusedDayIndex(clickedDayOfWeek);
    
    // currentWeek 업데이트 (일요일부터 토요일까지의 주)
    const startOfWeek = new Date(clickedDate);
    startOfWeek.setDate(clickedDate.getDate() - clickedDate.getDay());
    
    const newWeek = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      newWeek.push(date);
    }
    setCurrentWeek(newWeek);
    
    console.log('✅ handleDayFocus 완료:', {
      clickedDate: clickedDate.toISOString().split('T')[0],
      dayOfWeek: clickedDayOfWeek,
      focusedDayIndex: clickedDayOfWeek
    });
  }, []);

  // 🔧 시간을 픽셀 위치로 변환하는 함수 (디버깅 로그 추가)
  const calculateSlotPosition = useCallback((time) => {
    const minutes = parseTimeToMinutes(time);
    const slotIndex = minutes / 30;
    const pixelPosition = slotIndex * SLOT_HEIGHT;
    
    console.log('📍 시간 → 픽셀 변환:', {
      시간: time,
      분: minutes,
      슬롯인덱스: slotIndex,
      픽셀위치: pixelPosition,
      SLOT_HEIGHT
    });
    
    return pixelPosition;
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
    console.log('➕ addSchedule 호출됨:', {
      id: newSchedule.id,
      date: newSchedule.date,
      title: newSchedule.title,
      start: newSchedule.start,
      end: newSchedule.end
    });
    
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

  // 🎯 핵심 추가: handleAdd 함수 - 요일 다중 선택 지원
  const handleAdd = useCallback(async (formData) => {
    console.log('🔍 handleAdd 호출됨 (Logic)!');
    console.log('🔍 formData:', formData);
    console.log('🔍 formData.weekdays:', formData.weekdays);
    console.log('🔍 formData.weekdays.length:', formData.weekdays?.length);

    if (!formData.title || !formData.startSlot || !formData.end) {
      alert('제목, 시간을 모두 입력해주세요.');
      return { success: false, error: 'Missing required fields' };
    }

    const tagInfo = safeTagItems.find(
      item => item.tagType === formData.selectedTagType && item.tagName === formData.tag
    );

    const focusedBaseDate = new Date(currentWeek[focusedDayIndex]);
    
    const baseSchedule = {
      id: Date.now(),
      date: focusedBaseDate.toISOString().split("T")[0],
      start: formData.startSlot,
      end: formData.end,
      title: formData.title,
      description: formData.description || "",
      tag: formData.tag,
      tagType: tagInfo ? tagInfo.tagType : "",
      done: false
    };

    const repeatCount = parseInt(formData.repeatCount || "1");
    const interval = parseInt(formData.interval || "1");
    
    const selectedWeekdays = formData.weekdays && formData.weekdays.length > 0
      ? formData.weekdays
      : [DAYS_OF_WEEK[focusedDayIndex]];

    console.log('🗓️ 최종 선택된 요일들:', selectedWeekdays);
    console.log('📅 현재 주:', currentWeek.map(d => ({
      date: d.toISOString().split('T')[0],
      day: DAYS_OF_WEEK[d.getDay()]
    })));

    const newSchedules = [];
    let scheduleIdCounter = Date.now();

    // 🔧 getDayIndexFromKoreanDay 함수 검증
    console.log('🔍 getDayIndexFromKoreanDay 함수 테스트:');
    DAYS_OF_WEEK.forEach((day, idx) => {
      const calculatedIndex = getDayIndexFromKoreanDay(day);
      console.log(`${day}: 예상 ${idx} → 실제 ${calculatedIndex}`);
    });

    for (let week = 0; week < repeatCount; week++) {
      console.log(`\n📆 ${week + 1}번째 주 처리 중...`);
      
      for (let dayIdx = 0; dayIdx < selectedWeekdays.length; dayIdx++) {
        const koreanWeekday = selectedWeekdays[dayIdx];
        
        // 🔍 요일 인덱스 계산 디버깅
        const weekdayIndex = getDayIndexFromKoreanDay(koreanWeekday);
        console.log(`🔍 요일 처리: "${koreanWeekday}" → 인덱스 ${weekdayIndex}`);
        
        if (weekdayIndex === -1) {
          console.log(`❌ "${koreanWeekday}"는 유효하지 않은 요일입니다.`);
          continue;
        }

        // 🔍 날짜 계산 디버깅
        const currentWeekDate = currentWeek[weekdayIndex];
        console.log(`📅 currentWeek[${weekdayIndex}]:`, currentWeekDate.toISOString().split('T')[0]);
        
        const targetDate = new Date(currentWeekDate);
        targetDate.setDate(currentWeekDate.getDate() + (week * 7 * interval));
        
        console.log(`📅 최종 계산된 날짜: ${targetDate.toISOString().split('T')[0]} (${DAYS_OF_WEEK[targetDate.getDay()]})`);

        const schedule = {
          ...baseSchedule,
          id: scheduleIdCounter++, // 🔧 고유 ID 생성
          date: targetDate.toISOString().split("T")[0],
        };

        console.log(`✅ 생성될 일정:`, {
          id: schedule.id,
          date: schedule.date,
          title: schedule.title,
          start: schedule.start,
          end: schedule.end,
          expectedDay: koreanWeekday,
          actualDay: DAYS_OF_WEEK[targetDate.getDay()]
        });

        // 겹침 검사
        if (checkScheduleOverlap(safeSchedules, schedule)) {
          alert(`${targetDate.toLocaleDateString()} ${koreanWeekday}에 시간 겹침이 발생하여 일정 추가를 중단합니다.`);
          return { success: false, error: 'Schedule overlap detected' };
        }

        newSchedules.push(schedule);
      }
    }

    console.log(`\n🎯 최종 생성될 일정들:`, newSchedules.map(s => ({
      date: s.date,
      day: DAYS_OF_WEEK[new Date(s.date).getDay()],
      title: s.title,
      time: `${s.start}-${s.end}`
    })));

    // 실제 일정 추가
    let addedCount = 0;
    for (const schedule of newSchedules) {
      console.log(`📝 일정 추가 시도:`, schedule.date, schedule.title);
      const result = await addSchedule(schedule);
      if (result.success) {
        addedCount++;
        console.log(`✅ 일정 추가 성공: ${schedule.date} (${DAYS_OF_WEEK[new Date(schedule.date).getDay()]}) ${schedule.title}`);
      } else {
        console.error(`❌ 일정 추가 실패: ${result.error}`);
        alert(`일정 추가에 실패했습니다: ${result.error}`);
        return { success: false, error: result.error };
      }
    }

    console.log(`🎉 총 ${addedCount}개의 일정이 성공적으로 추가되었습니다!`);

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
    message.textContent = `🎉 ${addedCount}개 일정 추가 완료! (요일: ${selectedWeekdays.join(', ')})`;
    document.body.appendChild(message);
    
    setTimeout(() => {
      if (document.body.contains(message)) {
        document.body.removeChild(message);
      }
    }, 3000);

    return { success: true, addedCount };
  }, [safeTagItems, currentWeek, focusedDayIndex, DAYS_OF_WEEK, checkScheduleOverlap, safeSchedules, addSchedule]);

  // ✅ 문제 1 해결: 현재 포커스된 날짜의 월 정보를 계산
  const currentMonth = useMemo(() => {
    const focusedDate = currentWeek[focusedDayIndex];
    return {
      month: focusedDate.getMonth() + 1, // getMonth()는 0부터 시작
      year: focusedDate.getFullYear()
    };
  }, [currentWeek, focusedDayIndex]);

  // ✅ 문제 1 해결: 월별 태그 총합 계산 - useMemo로 최적화
  const tagTotals = useMemo(() => {
    return calculateTagTotals(safeSchedules, currentMonth);
  }, [safeSchedules, currentMonth]);

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
    isSaving,
    lastSyncTime,
    isInitialLoadComplete,
    
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
    currentMonth, // ✅ 추가: 현재 월 정보
    
    // 서버 관련 함수들
    loadDataFromServer,
    saveDataToServer,
    
    // 일정 관리 함수들
    addSchedule,
    updateSchedule,
    deleteSchedule,
    handleAdd, // 🎯 핵심 추가: handleAdd 함수
    
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
    getDayIndexFromKoreanDay, // ✅ 문제 3 해결용 함수 추가
    
    // 이벤트 핸들러들
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  };
};
