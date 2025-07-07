// pages/DetailedCalendar.jsx - 서버 기반 태그 색상 버전 (활동 요약 업데이트)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';

// 파스텔 색상 팔레트
const PASTEL_COLORS = [
  { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
  { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
  { bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
  { bg: "bg-pink-100", text: "text-pink-800", border: "border-pink-200" },
  { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-200" },
  { bg: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-200" },
  { bg: "bg-teal-100", text: "text-teal-800", border: "border-teal-200" },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
];

// 날짜 유틸리티 함수들
const formatDate = (date, format) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  switch (format) {
    case 'yyyy-MM-dd':
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    case 'yyyy년 M월':
      return `${year}년 ${month}월`;
    case 'yyyy년 M월 d일':
      return `${year}년 ${month}월 ${day}일`;
    case 'd':
      return day.toString();
    case 'M':
      return month.toString();
    default:
      return date.toString();
  }
};

const getMonthDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // 월의 첫째 날과 마지막 날
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // 캘린더 시작일 (일요일부터 시작)
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  // 캘린더 마지막일 (토요일까지)
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
  
  const days = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};

// 시간 관련 함수들
const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTimeString = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

// ✅ 서버 기반 일정 상세보기 모달 컴포넌트
const ScheduleDetailModal = ({ 
  isOpen, 
  onClose, 
  schedule, 
  safeTags,
  safeTagItems,
  getTagColor
}) => {
  if (!isOpen || !schedule) return null;

  // ✅ 서버 데이터에서 태그 색상 가져오기
  const getServerTagColor = () => {
    try {
      // 1. schedule.tagType이 있으면 직접 사용
      if (schedule.tagType && getTagColor) {
        return getTagColor(schedule.tagType);
      }
      
      // 2. schedule.tag로 tagType 찾기
      if (schedule.tag && safeTagItems) {
        const tagItem = safeTagItems.find(item => item.tagName === schedule.tag);
        if (tagItem?.tagType && getTagColor) {
          return getTagColor(tagItem.tagType);
        }
      }
      
      // 3. safeTags에서 직접 찾기
      if (schedule.tag && safeTags) {
        const tag = safeTags.find(tag => tag.tagType === schedule.tag);
        if (tag?.color && typeof tag.color === 'object') {
          return tag.color;
        }
      }
      
      // 4. 기본 색상 반환
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
    } catch (error) {
      console.warn('모달 태그 색상 조회 실패:', error);
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
    }
  };

  const tagColor = getServerTagColor();

  // ✅ 태그 정보 구성
  const getTagDisplayInfo = () => {
    if (schedule.tagType && schedule.tag) {
      return `${schedule.tag} | ${schedule.tagType}`;
    } else if (schedule.tag) {
      // tagType을 safeTagItems에서 찾기
      const tagItem = safeTagItems?.find(item => item.tagName === schedule.tag);
      if (tagItem?.tagType) {
        return `${schedule.tag} | ${tagItem.tagType}`;
      }
      return schedule.tag;
    }
    return '태그 없음';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-bold">📅 일정 상세보기</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          {/* 태그 - 서버에서 색상 가져오기 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">태그</label>
            <div className={`inline-block px-3 py-1 rounded-full text-sm ${tagColor.bg} ${tagColor.text} ${tagColor.border || ''} border`}>
              {getTagDisplayInfo()}
            </div>
          </div>
          
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">제목</label>
            <div className="text-lg font-semibold text-gray-800">{schedule.title}</div>
          </div>
          
          {/* 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">시작 시간</label>
              <div className="text-gray-800 font-medium">{schedule.start}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">종료 시간</label>
              <div className="text-gray-800 font-medium">{schedule.end}</div>
            </div>
          </div>
          
          {/* 소요 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">소요 시간</label>
            <div className="text-gray-800 font-medium">
              {(() => {
                const startMinutes = parseTimeToMinutes(schedule.start);
                const endMinutes = parseTimeToMinutes(schedule.end);
                const duration = endMinutes - startMinutes;
                return minutesToTimeString(duration);
              })()}
            </div>
          </div>
          
          {/* 설명 */}
          {schedule.description && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">설명</label>
              <div className="text-gray-800 bg-gray-50 p-3 rounded-lg">
                {schedule.description}
              </div>
            </div>
          )}
          
          {/* 날짜 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">날짜</label>
            <div className="text-gray-800 font-medium">
              {new Date(schedule.date).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
              })}
            </div>
          </div>

          {/* 완료 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">상태</label>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              schedule.done 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
            }`}>
              {schedule.done ? '✅ 완료' : '⏳ 진행중'}
            </div>
          </div>

          {/* 서버 동기화 정보 */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center text-xs text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              서버 데이터 (실시간 동기화)
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// ✨ 서버 데이터 새로고침 컴포넌트
const ServerDataRefresher = ({ currentUser, onDataRefresh, isAdminView, lastSyncTime }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !currentUser || !onDataRefresh) return;

    try {
      setIsRefreshing(true);
      console.log('🔄 서버 데이터 새로고침 시작:', currentUser);

      // 서버에서 최신 데이터 로드
      const result = await loadUserDataFromDAL(currentUser);
      if (result.success && result.data) {
        onDataRefresh(result.data);
        console.log('✅ 서버 데이터 새로고침 완료');
      } else {
        throw new Error(result.error || '서버 데이터 로드 실패');
      }
    } catch (error) {
      console.error('❌ 서버 데이터 새로고침 실패:', error);
      alert('데이터 새로고침에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isAdminView) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span>마지막 새로고침: {lastSyncTime ? lastSyncTime.toLocaleTimeString('ko-KR') : '없음'}</span>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
          isRefreshing 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
      >
        {isRefreshing ? '새로고침 중...' : '🔄 새로고침'}
      </button>
    </div>
  );
};

// 메인 DetailedCalendar 컴포넌트
const DetailedCalendar = ({ 
  schedules: initialSchedules = [], 
  tags: initialTags = [], 
  tagItems: initialTagItems = [], 
  monthlyGoals: initialMonthlyGoals = [],
  monthlyPlans: initialMonthlyPlans = [],
  currentUser = 'demo-user',
  isAdminView = false,
  isServerBased = false,
  onLogout = () => {},
  onBackToDashboard = null,
  onRefresh = null,
  lastSyncTime = null
}) => {
  // ✨ 서버 동기화를 위한 로컬 상태
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(lastSyncTime || new Date());
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const navigate = useNavigate();

  // ✅ 서버 기반 태그 색상 가져오기 함수
  const getTagColor = useCallback((tagType) => {
    if (!tagType) {
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
    }

    try {
      // 1. 서버 데이터에서 태그 색상 찾기
      if (tags && Array.isArray(tags)) {
        const serverTag = tags.find(tag => tag.tagType === tagType);
        if (serverTag?.color && typeof serverTag.color === 'object') {
          console.log(`✅ ${tagType} 서버 색상 사용:`, serverTag.color);
          return serverTag.color;
        }
      }

      // 2. 서버에 색상 정보가 없으면 해시 기반으로 생성
      console.log(`⚠️ ${tagType} 서버 색상 없음, 해시 기반 생성`);
      const index = Math.abs(tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
      return PASTEL_COLORS[index];

    } catch (error) {
      console.warn('태그 색상 조회 실패:', { tagType, error });
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
    }
  }, [tags]);

  // ✨ 서버에서 데이터 로드
  const loadDataFromServer = async () => {
    if (!currentUser || !supabase) return;

    try {
      setLoading(true);
      console.log('🌐 서버에서 데이터 로드 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        const serverData = result.data;
        
        // ✅ 태그 색상 정보 검증 및 보완
        if (serverData.tags && Array.isArray(serverData.tags)) {
          serverData.tags = serverData.tags.map(tag => {
            // 색상 정보가 없거나 올바르지 않은 경우 생성
            if (!tag.color || typeof tag.color !== 'object' || !tag.color.bg) {
              const index = Math.abs(tag.tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
              tag.color = PASTEL_COLORS[index];
              console.log(`🎨 ${tag.tagType} 색상 생성:`, tag.color);
            }
            return tag;
          });
        }
        
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: serverData.schedules?.length || 0,
          tags: serverData.tags?.length || 0,
          tagItems: serverData.tagItems?.length || 0,
          monthlyGoals: serverData.monthlyGoals?.length || 0
        });

        setSchedules(serverData.schedules || []);
        setTags(serverData.tags || []);
        setTagItems(serverData.tagItems || []);
        setMonthlyGoals(serverData.monthlyGoals || []);
        setMonthlyPlans(serverData.monthlyPlans || []);
        setLastRefresh(new Date());
      } else {
        console.warn('⚠️ 서버 데이터 없음:', result.error);
        // 빈 데이터로 초기화
        setSchedules([]);
        setTags([]);
        setTagItems([]);
        setMonthlyGoals([]);
        setMonthlyPlans([]);
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✨ 초기 데이터 로드 (서버 기반 모드인 경우)
  useEffect(() => {
    if (isServerBased) {
      console.log('🌐 서버 기반 모드 - 서버에서 데이터 로드');
      loadDataFromServer();
    } else {
      console.log('📦 props 기반 모드 - 전달받은 데이터 사용');
      
      // ✅ props로 받은 태그 데이터도 색상 정보 보완
      let processedTags = initialTags || [];
      if (Array.isArray(processedTags)) {
        processedTags = processedTags.map(tag => {
          if (!tag.color || typeof tag.color !== 'object' || !tag.color.bg) {
            const index = Math.abs(tag.tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
            tag.color = PASTEL_COLORS[index];
            console.log(`🎨 props 태그 ${tag.tagType} 색상 생성:`, tag.color);
          }
          return tag;
        });
      }
      
      setSchedules(initialSchedules);
      setTags(processedTags);
      setTagItems(initialTagItems);
      setMonthlyGoals(initialMonthlyGoals);
      setMonthlyPlans(initialMonthlyPlans);
    }
  }, [currentUser, isServerBased]);

  // ✨ props 변경 시 로컬 상태 업데이트 (비서버 모드)
  useEffect(() => {
    if (!isServerBased) {
      console.log('📊 DetailedCalendar props 업데이트:', {
        currentUser,
        isAdminView,
        schedules: initialSchedules?.length || 0,
        tags: initialTags?.length || 0,
        tagItems: initialTagItems?.length || 0,
        monthlyGoals: initialMonthlyGoals?.length || 0
      });

      // ✅ props 태그 데이터 색상 정보 보완
      let processedTags = initialTags || [];
      if (Array.isArray(processedTags)) {
        processedTags = processedTags.map(tag => {
          if (!tag.color || typeof tag.color !== 'object' || !tag.color.bg) {
            const index = Math.abs(tag.tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
            tag.color = PASTEL_COLORS[index];
            console.log(`🎨 props 업데이트 태그 ${tag.tagType} 색상 생성:`, tag.color);
          }
          return tag;
        });
      }

      setSchedules(initialSchedules);
      setTags(processedTags);
      setTagItems(initialTagItems);
      setMonthlyGoals(initialMonthlyGoals);
      setMonthlyPlans(initialMonthlyPlans);
    }
  }, [initialSchedules, initialTags, initialTagItems, initialMonthlyGoals, initialMonthlyPlans, isServerBased]);

  // ✨ 서버 데이터 새로고침 핸들러
  const handleDataRefresh = async (freshData = null) => {
    if (freshData) {
      console.log('🔄 새로운 데이터 적용:', freshData);
      
      // ✅ 새로고침 데이터도 색상 정보 보완
      let processedTags = freshData.tags || [];
      if (Array.isArray(processedTags)) {
        processedTags = processedTags.map(tag => {
          if (!tag.color || typeof tag.color !== 'object' || !tag.color.bg) {
            const index = Math.abs(tag.tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
            tag.color = PASTEL_COLORS[index];
            console.log(`🎨 새로고침 태그 ${tag.tagType} 색상 생성:`, tag.color);
          }
          return tag;
        });
      }
      
      setSchedules(freshData.schedules || []);
      setTags(processedTags);
      setTagItems(freshData.tagItems || []);
      setMonthlyGoals(freshData.monthlyGoals || []);
      setMonthlyPlans(freshData.monthlyPlans || []);
      setLastRefresh(new Date());
    } else if (isServerBased) {
      // 직접 서버에서 로드
      await loadDataFromServer();
    } else if (onRefresh) {
      // 부모 컴포넌트의 새로고침 함수 호출
      onRefresh();
    }
  };

  // 안전한 배열 보장
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeTagItems = Array.isArray(tagItems) ? tagItems : [];
  const safeMonthlyGoals = Array.isArray(monthlyGoals) ? monthlyGoals : [];

  // ✨ 데이터 없음 상태 처리 개선
  if (!loading && safeSchedules.length === 0 && safeTags.length === 0 && safeTagItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* 관리자 네비게이션 바 */}
        {isAdminView && (
          <nav className="bg-red-600 text-white p-4 shadow-lg">
            <div className="container mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-4">
                {onBackToDashboard && (
                  <button 
                    onClick={onBackToDashboard}
                    className="hover:bg-red-700 px-3 py-1.5 rounded transition duration-200 flex items-center"
                  >
                    <span className="mr-2">←</span>
                    대시보드로
                  </button>
                )}
                <div className="border-l border-red-400 pl-4">
                  <h1 className="text-xl font-bold">
                    👑 {currentUser}님의 상세 캘린더
                  </h1>
                  <p className="text-red-200 text-sm">관리자 모드 - 데이터 없음 (서버 기반)</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <ServerDataRefresher 
                  currentUser={currentUser}
                  onDataRefresh={handleDataRefresh}
                  isAdminView={isAdminView}
                  lastSyncTime={lastRefresh}
                />
                <span className="text-red-200 text-sm">
                  {new Date().toLocaleDateString('ko-KR')}
                </span>
                {onLogout && (
                  <button 
                    onClick={onLogout}
                    className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded transition duration-200"
                  >
                    로그아웃
                  </button>
                )}
              </div>
            </div>
          </nav>
        )}

        {/* 데이터 없음 메시지 */}
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white rounded-lg shadow-lg p-12 text-center max-w-md">
            <div className="text-gray-400 text-6xl mb-6">🌐</div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-3">
              서버에 데이터가 없습니다
            </h3>
            <p className="text-gray-500 mb-6">
              <strong>{currentUser}님</strong>의 캘린더 데이터를 Supabase 서버에서 찾을 수 없습니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
              <h4 className="font-semibold mb-2">💡 확인 사항</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 해당 멤버가 로그인하여 데이터를 서버에 저장했는지 확인</li>
                <li>• 일정을 등록한 적이 있는지 확인</li>
                <li>• Supabase 서버 연결 상태 확인</li>
                <li>• 네트워크 연결 상태 확인</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDataRefresh()}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? '🔄 로딩...' : '🔄 서버 새로고침'}
              </button>
              {onBackToDashboard && (
                <button
                  onClick={onBackToDashboard}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  관리자 대시보드로 돌아가기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 현재 월의 날짜들
  const days = getMonthDays(currentDate);
  
  // 현재 월의 일정들만 필터링 - 수정된 로직
  const currentMonthSchedules = safeSchedules.filter(schedule => {
    try {
      const scheduleDate = new Date(schedule.date);
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      const scheduleYear = scheduleDate.getFullYear();
      const scheduleMonth = scheduleDate.getMonth();
      
      console.log('일정 필터링:', {
        schedule: schedule.date,
        currentYear,
        currentMonth,
        scheduleYear,
        scheduleMonth,
        match: currentYear === scheduleYear && currentMonth === scheduleMonth
      });
      
      return currentYear === scheduleYear && currentMonth === scheduleMonth;
    } catch (error) {
      console.warn('일정 날짜 파싱 실패:', schedule.date, error);
      return false;
    }
  });

  // 태그별 총 시간 계산
  const calculateMonthlyTagTotals = () => {
    const totals = {};
    
    currentMonthSchedules.forEach(schedule => {
      const tagType = schedule.tagType || "기타";
      
      if (!totals[tagType]) {
        totals[tagType] = 0;
      }
      
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const duration = endMinutes - startMinutes;
      
      totals[tagType] += duration;
    });
    
    return totals;
  };

  // 월간 목표 불러오기 - 수정된 로직
  const getCurrentMonthGoals = () => {
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentMonthKey = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`;
    
    console.log('월간 목표 조회:', {
      currentMonthKey,
      monthlyGoals: safeMonthlyGoals,
      found: safeMonthlyGoals.find(goal => goal.month === currentMonthKey)
    });
    
    const found = safeMonthlyGoals.find(goal => goal.month === currentMonthKey);
    return found?.goals || [];
  };

  // 퍼센테이지 계산
  const calculatePercentage = (actual, goal) => {
    if (goal === 0) return 0;
    return Math.round((actual / goal) * 100);
  };

  // 특정 날짜의 일정들 가져오기
  const getSchedulesForDate = (date) => {
    const dateString = formatDate(date, 'yyyy-MM-dd');
    return safeSchedules.filter(schedule => schedule.date === dateString)
      .sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start));
  };

  // 일정 클릭 핸들러
  const handleScheduleClick = (schedule, e) => {
    e.stopPropagation();
    console.log('📅 일정 클릭:', schedule);
    setSelectedSchedule(schedule);
    setIsDetailModalOpen(true);
  };

  // 이전/다음 달로 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthlyTagTotals = calculateMonthlyTagTotals();
  const currentMonthGoalsData = getCurrentMonthGoals();
  
  // 디버깅 로그 추가
  console.log('📊 활동 요약 데이터:', {
    currentMonthSchedules: currentMonthSchedules.length,
    monthlyTagTotals,
    currentMonthGoalsData,
    safeSchedules: safeSchedules.length,
    currentDate: formatDate(currentDate, 'yyyy년 M월')
  });
  
  // 목표가 있거나 이번 달에 실제 사용된 태그타입만 표시
  const goalTagTypes = currentMonthGoalsData.map(goal => goal.tagType);
  const currentMonthUsedTagTypes = [...new Set(currentMonthSchedules.map(schedule => schedule.tagType || "기타"))];
  
  const allTagTypes = [...new Set([...goalTagTypes, ...currentMonthUsedTagTypes])];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 관리자 네비게이션 바 */}
      {isAdminView && (
        <nav className="bg-red-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {onBackToDashboard && (
                <button 
                  onClick={onBackToDashboard}
                  className="hover:bg-red-700 px-3 py-1.5 rounded transition duration-200 flex items-center"
                >
                  <span className="mr-2">←</span>
                  대시보드로
                </button>
              )}
              <div className="border-l border-red-400 pl-4">
                <h1 className="text-xl font-bold">
                  👑 {currentUser}님의 상세 캘린더 (읽기 전용)
                </h1>
                <p className="text-red-200 text-sm">관리자 모드 - 서버 기반 (태그 색상 동기화)</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ServerDataRefresher 
                currentUser={currentUser}
                onDataRefresh={handleDataRefresh}
                isAdminView={isAdminView}
                lastSyncTime={lastRefresh}
              />
              <span className="text-red-200 text-sm">
                {new Date().toLocaleDateString('ko-KR')}
              </span>
              {onLogout && (
                <button 
                  onClick={onLogout}
                  className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded transition duration-200"
                >
                  로그아웃
                </button>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* 서버 기반 모드 알림 배너 */}
      {(isAdminView || isServerBased) && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-blue-400 text-xl">🌐</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                {isAdminView ? '관리자 모드 (읽기 전용)' : '서버 기반 모드'} - 태그 색상 동기화
              </h3>
              <div className="mt-1 text-sm text-blue-700">
                <p>
                  <strong>{currentUser}님</strong>의 상세한 일정 정보와 태그 색상을 Supabase 서버에서 실시간으로 조회하고 있습니다. 
                  {isAdminView && <strong> 일정을 클릭하면 상세 정보를 확인할 수 있습니다.</strong>}
                  {lastRefresh && ` (마지막 동기화: ${lastRefresh.toLocaleTimeString('ko-KR')})`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-200 rounded-lg text-xl transition-colors"
            >
              ←
            </button>
            <h2 className="text-3xl font-bold text-gray-800">
              {formatDate(currentDate, 'yyyy년 M월')}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-200 rounded-lg text-xl transition-colors"
            >
              →
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 text-right">
              <div>{isAdminView ? `조회 대상: ${currentUser}` : `사용자: ${currentUser}`}</div>
              <div className="text-xs text-gray-500">
                이번 달: {currentMonthSchedules.length}개 일정
                {isServerBased && ' | 서버 기반 (색상 동기화)'}
              </div>
            </div>
            <button
              onClick={goToToday}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              오늘
            </button>
            {isServerBased && (
              <button
                onClick={() => handleDataRefresh()}
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? '🔄 로딩...' : '🔄 새로고침'}
              </button>
            )}
          </div>
        </div>

        {/* ✅ 이번 달 활동 요약 - CalendarPage 스타일 적용 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-700 flex items-center">
            <span className="mr-2">📊</span>
            {formatDate(currentDate, 'yyyy년 M월')} 활동 요약
            {isServerBased && (
              <span className="ml-2 text-sm text-gray-500">(서버 데이터 기반 - 태그 색상 동기화)</span>
            )}
          </h2>
          
          {allTagTypes.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {allTagTypes.map((tagType) => {
                const tagColor = getTagColor(tagType); // ✅ 서버 기반 색상 함수 사용
                const actualMinutes = monthlyTagTotals[tagType] || 0;
                const actualTime = minutesToTimeString(actualMinutes);
                
                // 목표 시간 찾기
                const goal = currentMonthGoalsData.find(g => g.tagType === tagType);
                const goalMinutes = goal ? parseTimeToMinutes(goal.targetHours) : 0;
                const goalTime = goal ? goal.targetHours : "00:00";
                
                // 퍼센테이지 계산
                const percentage = calculatePercentage(actualMinutes, goalMinutes);
                
                // 진행률에 따른 색상 결정
                const getProgressColor = (percent) => {
                  if (percent >= 100) return "text-green-600";
                  if (percent >= 75) return "text-blue-600";
                  if (percent >= 50) return "text-yellow-600";
                  return "text-red-600";
                };
                
                return (
                  <div
                    key={tagType}
                    className={`p-4 w-60 rounded-lg border-2 ${tagColor.bg} ${tagColor.border} shadow-sm hover:shadow-md transition-shadow flex-shrink-0`}
                  >
                    <div className="mb-2">
                      <span className={`font-medium ${tagColor.text}`}>{tagType}</span>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">실제:</span>
                        <span className={`font-semibold ${tagColor.text}`}>{actualTime}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-600">목표:</span>
                        <span className={`font-semibold ${tagColor.text}`}>{goalTime}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">달성률:</span>
                        <span className={`font-bold text-lg ${getProgressColor(percentage)}`}>
                          {percentage}%
                        </span>
                      </div>
                      
                      {/* 진행률 바 */}
                      <div className="w-full bg-white rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            percentage >= 100 ? 'bg-green-500' :
                            percentage >= 75 ? 'bg-blue-500' :
                            percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* ✅ 서버 색상 표시 */}
                    <div className="mt-2 text-xs text-gray-500 opacity-70 text-center">
                      🌐 서버 기반 색상
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-sm">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-lg font-medium">아직 등록된 일정이 없습니다.</p>
              <p className="text-sm mt-2">일정을 추가하여 월별 활동을 확인해보세요!</p>
              {isAdminView && (
                <p className="text-xs mt-2 text-blue-600">
                  관리자 모드: {currentUser}님의 서버 데이터를 조회 중입니다.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 캘린더 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 bg-gray-100 border-b">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
              <div key={day} className={`p-3 text-center font-medium ${
                index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-700'
              }`}>
                {day}
              </div>
            ))}
          </div>
          
          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const isCurrentMonth = formatDate(day, 'M') === formatDate(currentDate, 'M');
              const isToday = formatDate(day, 'yyyy-MM-dd') === formatDate(new Date(), 'yyyy-MM-dd');
              const daySchedules = getSchedulesForDate(day);
              const isWeekend = index % 7 === 0 || index % 7 === 6;
              
              return (
                <div
                  key={day.toString()}
                  className={`
                    relative p-2 min-h-[140px] border-r border-b transition-colors
                    ${isToday ? 'bg-blue-50' : ''}
                    ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''}
                    ${isWeekend && isCurrentMonth ? 'bg-gray-25' : ''}
                  `}
                >
                  {/* 날짜 표시 */}
                  <div className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium mb-2
                    ${isToday ? 'bg-blue-500 text-white' : 
                      index % 7 === 0 ? 'text-red-600' : 
                      index % 7 === 6 ? 'text-blue-600' : 'text-gray-700'}
                    ${!isCurrentMonth ? 'text-gray-400' : ''}
                  `}>
                    {formatDate(day, 'd')}
                  </div>
                  
                  {/* 일정 목록 - ✅ 서버 기반 색상 사용 */}
                  <div className="space-y-1">
                    {daySchedules.map((schedule) => {
                      const tagType = schedule.tagType || "기타";
                      const tagColor = getTagColor(tagType); // ✅ 서버 기반 색상 함수 사용
                      
                      return (
                        <div
                          key={schedule.id}
                          className={`
                            ${tagColor.bg} ${tagColor.border} border rounded-md p-2 text-xs
                            hover:shadow-md cursor-pointer transition-all transform hover:scale-105
                          `}
                          onClick={(e) => handleScheduleClick(schedule, e)}
                          title={`${schedule.start} - ${schedule.end}\n${schedule.tag} - ${schedule.title}\n${schedule.description || ''}\n🎨 서버 색상 적용`}
                        >
                          <div className="space-y-1">
                            {/* 시간 */}
                            <div className={`font-bold ${tagColor.text} text-left`}>
                              {schedule.start} - {schedule.end}
                            </div>
                            {/* 태그와 제목 */}
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${tagColor.bg.replace('100', '500')} flex-shrink-0`}></div>
                              <div className={`font-medium ${tagColor.text} truncate flex-1`}>
                                {schedule.tag} | {schedule.title}
                              </div>
                            </div>
                            {/* 설명 */}
                            {schedule.description && (
                              <div className="text-gray-600 truncate text-[10px] italic">
                                {schedule.description}
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

        {/* ✅ 서버 기반 일정 상세보기 모달 */}
        <ScheduleDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          schedule={selectedSchedule}
          safeTags={safeTags}
          safeTagItems={safeTagItems}
          getTagColor={getTagColor}
        />
        
        {/* 안내 메시지 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">💡 사용법</h4>
            <p className="text-blue-700 text-sm">
              {isAdminView 
                ? '일정을 클릭하면 상세 정보를 확인할 수 있습니다. 관리자 모드로 모든 편집 기능이 비활성화되어 있으며, 서버에서 실시간 데이터와 태그 색상을 조회합니다.'
                : '일정을 클릭하면 상세 정보를 확인할 수 있습니다. 모든 태그 색상이 서버에서 동기화됩니다.'
              }
            </p>
          </div>
          
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 mb-2">
              📊 이번 달 통계 
              {isServerBased && ' (서버 기반 - 색상 동기화)'}
            </h4>
            <div className="text-green-700 text-sm space-y-1">
              <div>총 일정: {currentMonthSchedules.length}개</div>
              <div>활동 유형: {allTagTypes.length}개</div>
              <div>태그 색상: 서버 동기화</div>
              {lastRefresh && (
                <div className="text-xs text-green-600">
                  마지막 업데이트: {lastRefresh.toLocaleTimeString('ko-KR')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 관리자 플로팅 도구 */}
      {isAdminView && onBackToDashboard && (
        <div className="fixed bottom-6 right-6 flex flex-col space-y-2">
          <button
            onClick={onBackToDashboard}
            className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition duration-200"
            title="대시보드로 돌아가기"
          >
            <span className="text-lg">🏠</span>
          </button>
          <button
            onClick={() => {
              const totalMinutes = Object.values(monthlyTagTotals).reduce((sum, minutes) => sum + minutes, 0);
              const totalTime = minutesToTimeString(totalMinutes);
              
              alert(`📊 ${currentUser}님 ${formatDate(currentDate, 'yyyy년 M월')} 요약 (서버 데이터 - 색상 동기화)\n\n` +
                `• 총 일정: ${safeSchedules.length}개\n` +
                `• 이번 달 일정: ${currentMonthSchedules.length}개\n` +
                `• 총 활동 시간: ${totalTime}\n` +
                `• 태그 타입: ${allTagTypes.length}개\n` +
                `• 평균 달성률: ${allTagTypes.length > 0 ? Math.round(allTagTypes.reduce((sum, tagType) => {
                  const actualMinutes = monthlyTagTotals[tagType] || 0;
                  const goal = currentMonthGoalsData.find(g => g.tagType === tagType);
                  const goalMinutes = goal ? parseTimeToMinutes(goal.targetHours) : 0;
                  const percentage = calculatePercentage(actualMinutes, goalMinutes);
                  return sum + percentage;
                }, 0) / allTagTypes.length) : 0}%\n\n` +
                `• 태그 색상: 서버에서 동기화\n` +
                `• 색상 데이터 소스: Supabase 서버\n\n` +
                `조회 시간: ${new Date().toLocaleString('ko-KR')}\n` +
                `데이터 소스: Supabase 서버`
              );
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition duration-200"
            title="월별 통계 보기"
          >
            <span className="text-lg">📊</span>
          </button>
          <button
            onClick={() => handleDataRefresh()}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full shadow-lg transition duration-200 disabled:opacity-50"
            title="서버 데이터 새로고침 (색상 포함)"
          >
            <span className="text-lg">{loading ? '⏳' : '🔄'}</span>
          </button>
          {/* ✅ 태그 색상 디버그 버튼 추가 */}
          <button
            onClick={() => {
              console.log('🎨 태그 색상 디버그 정보:');
              console.log('서버 태그 데이터:', safeTags);
              console.log('색상 함수 테스트:', allTagTypes.map(tagType => ({
                tagType,
                color: getTagColor(tagType)
              })));
              
              alert(`🎨 태그 색상 디버그 정보\n\n` +
                `• 총 태그 타입: ${safeTags.length}개\n` +
                `• 활성 태그 타입: ${allTagTypes.length}개\n` +
                `• 서버 색상 동기화: ✅ 활성\n` +
                `• 색상 소스: Supabase 서버\n\n` +
                `자세한 정보는 개발자 도구 콘솔을 확인하세요.`
              );
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition duration-200"
            title="태그 색상 디버그"
          >
            <span className="text-lg">🎨</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DetailedCalendar;
