import React, { useState, useEffect, useCallback, useRef } from "react";
import { useWeeklyCalendarLogic } from "./WeeklyCalendarLogic";
import { WeeklyCalendarUI } from "./WeeklyCalendarUI";
import { saveUserDataToDAL, loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';

// ✨ 서버 데이터 새로고침 컴포넌트
const ServerDataRefresher = ({ currentUser, onDataRefresh, isAdminView, lastSyncTime }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !currentUser || !onDataRefresh) return;

    try {
      setIsRefreshing(true);
      console.log('🔄 서버 데이터 새로고침 시작:', currentUser);

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

const WeeklyCalendar = ({ 
  currentUser = 'demo-user',
  onLogout,
  isAdminView = false,
  onBackToDashboard = null
}) => {
  // ✨ 100% 서버 기반 상태 (로컬 저장 완전 제거)
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState(null);

  // ✨ 무한 루프 방지를 위한 ref
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef(null);

  // ✨ 서버에서 데이터 로드 - useCallback으로 메모이제이션
  const loadDataFromServer = useCallback(async () => {
    if (!currentUser || !supabase) return;

    try {
      setLoading(true);
      setError(null);
      console.log('🌐 서버에서 데이터 로드 시작:', currentUser);

      const result = await loadUserDataFromDAL(currentUser);
      
      if (result.success && result.data) {
        const serverData = result.data;
        
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: serverData.schedules?.length || 0,
          tags: serverData.tags?.length || 0,
          tagItems: serverData.tagItems?.length || 0
        });

        // 초기 로드가 아닌 경우에만 상태 업데이트
        if (!isInitialLoad.current || 
            JSON.stringify(schedules) !== JSON.stringify(serverData.schedules || []) ||
            JSON.stringify(tags) !== JSON.stringify(serverData.tags || []) ||
            JSON.stringify(tagItems) !== JSON.stringify(serverData.tagItems || [])) {
          
          setSchedules(serverData.schedules || []);
          setTags(serverData.tags || []);
          setTagItems(serverData.tagItems || []);
          setLastRefresh(new Date());
        }
        
        isInitialLoad.current = false;
      } else {
        console.warn('⚠️ 서버 데이터 없음:', result.error);
        setSchedules([]);
        setTags([]);
        setTagItems([]);
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 실패:', error);
      setError('서버 연결에 실패했습니다. 네트워크를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, schedules, tags, tagItems]);

  // ✨ 서버에 데이터 저장 - 디바운싱 적용
  const saveDataToServer = useCallback(async (newSchedules, newTags, newTagItems) => {
    if (!currentUser || isAdminView) return;

    // 이전 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 디바운싱 적용 (500ms 지연)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        console.log('💾 서버에 데이터 저장 중...');

        await saveUserDataToDAL(currentUser, {
          schedules: newSchedules,
          tags: newTags,
          tagItems: newTagItems
        });

        console.log('✅ 서버 저장 완료');
        setLastRefresh(new Date());
      } catch (error) {
        console.error('❌ 서버 저장 실패:', error);
        alert('서버 저장에 실패했습니다. 다시 시도해주세요.');
        // 저장 실패 시 서버에서 다시 로드
        await loadDataFromServer();
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [currentUser, isAdminView, loadDataFromServer]);

  // ✨ 초기 데이터 로드
  useEffect(() => {
    console.log('🌐 100% 서버 기반 모드 - 서버에서 데이터 로드');
    loadDataFromServer();
  }, [currentUser]); // loadDataFromServer 제거하여 무한 루프 방지

  // ✨ 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ✨ 서버 데이터 새로고침 핸들러
  const handleDataRefresh = useCallback(async (freshData = null) => {
    if (freshData) {
      console.log('🔄 새로운 데이터 적용:', freshData);
      setSchedules(freshData.schedules || []);
      setTags(freshData.tags || []);
      setTagItems(freshData.tagItems || []);
      setLastRefresh(new Date());
    } else {
      await loadDataFromServer();
    }
  }, [loadDataFromServer]);

  // ✨ 서버 기반 setSchedules (디바운싱 적용)
  const handleSetSchedules = useCallback(async (newSchedules) => {
    setSchedules(newSchedules);
    await saveDataToServer(newSchedules, tags, tagItems);
  }, [tags, tagItems, saveDataToServer]);

  // ✨ 서버 기반 setTags (디바운싱 적용)
  const handleSetTags = useCallback(async (newTags) => {
    setTags(newTags);
    await saveDataToServer(schedules, newTags, tagItems);
  }, [schedules, tagItems, saveDataToServer]);

  // ✨ 서버 기반 setTagItems (디바운싱 적용)
  const handleSetTagItems = useCallback(async (newTagItems) => {
    setTagItems(newTagItems);
    await saveDataToServer(schedules, tags, newTagItems);
  }, [schedules, tags, saveDataToServer]);

  // ✨ 로딩 상태 처리
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            서버에서 데이터를 불러오는 중...
          </h3>
          <p className="text-sm text-gray-500">{currentUser}님의 캘린더 데이터</p>
        </div>
      </div>
    );
  }

  // ✨ 에러 상태 처리
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-3">서버 연결 오류</h3>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={loadDataFromServer}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // ✨ 데이터 없음 상태 처리
  if (schedules.length === 0 && tags.length === 0 && tagItems.length === 0) {
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
                    👑 {currentUser}님의 주간 캘린더
                  </h1>
                  <p className="text-red-200 text-sm">관리자 모드 - 100% 서버 기반</p>
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
            <div className="text-gray-400 text-6xl mb-6">📅</div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-3">
              캘린더가 비어있습니다
            </h3>
            <p className="text-gray-500 mb-6">
              <strong>{currentUser}님</strong>의 캘린더 데이터가 서버에 없습니다.
              {isAdminView ? ' 사용자가 아직 일정을 등록하지 않았습니다.' : ' 첫 번째 일정을 추가해보세요!'}
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
              <h4 className="font-semibold mb-2">💡 안내</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 모든 데이터는 Supabase 서버에 실시간 저장됩니다</li>
                <li>• 로컬 저장소는 사용하지 않습니다</li>
                {isAdminView ? (
                  <>
                    <li>• 관리자 모드에서는 읽기만 가능합니다</li>
                    <li>• 사용자가 직접 로그인하여 일정을 추가해야 합니다</li>
                  </>
                ) : (
                  <>
                    <li>• 일정 추가/수정/삭제가 즉시 서버에 반영됩니다</li>
                    <li>• 네트워크 연결이 필요합니다</li>
                  </>
                )}
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDataRefresh()}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? '🔄 로딩...' : '🔄 새로고침'}
              </button>
              {onBackToDashboard && (
                <button
                  onClick={onBackToDashboard}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  돌아가기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 로직 훅 사용 - useMemo로 props 메모이제이션하여 무한 루프 방지
  const calendarLogicProps = React.useMemo(() => ({
    schedules,
    setSchedules: handleSetSchedules,
    tags,
    setTags: handleSetTags,
    tagItems,
    setTagItems: handleSetTagItems,
    currentUser
  }), [schedules, tags, tagItems, currentUser, handleSetSchedules, handleSetTags, handleSetTagItems]);

  const calendarLogic = useWeeklyCalendarLogic(calendarLogicProps);

  // 나머지 코드는 동일...
  const {
    // 상태와 데이터
    safeSchedules,
    safeTags,
    safeTagItems,
    currentWeek,
    focusedDayIndex,
    form,
    setForm,
    startSlot,
    setStartSlot,
    selectedTagType,
    setSelectedTagType,
    newTagType,
    setNewTagType,
    newTagName,
    setNewTagName,
    contextMenu,
    setContextMenu,
    copyingSchedule,
    setCopyingSchedule,
    showOverlapMessage,
    setShowOverlapMessage,
    setCurrentWeek,
    setFocusedDayIndex,
    setVisibleDays,
    setActiveTimeSlot,
    setDragging,
    setDragOffset,
    
    // 상수들
    DAYS_OF_WEEK,
    
    // 헬퍼 함수들
    assignNewTagColor,
    handleDayFocus,
    checkScheduleOverlap,
    parseTimeToMinutes,
    minutesToTimeString,
    getDayOfWeek,
    pixelToNearestTimeSlot
  } = calendarLogic;

  // 나머지 핸들러들은 동일하므로 생략...
  // [여기에 기존의 모든 핸들러 함수들이 들어갑니다]

  return (
    <div className="relative">
      {/* 기존 UI 코드와 동일 */}
      <WeeklyCalendarUI
        calendarLogic={calendarLogic}
        currentUser={currentUser}
        onLogout={onLogout}
        // ... 기존 props들
        isAdminView={isAdminView}
        saving={saving}
        onDataRefresh={handleDataRefresh}
      />
    </div>
  );
};

export default function SimplifiedWeeklyCalendar(props) {
  return <WeeklyCalendar {...props} />;
}
