import React, { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// 🛠️ 안전한 데이터 필터링 함수들
const createSafeSchedules = (rawSchedules) => {
  if (!Array.isArray(rawSchedules)) {
    console.warn('⚠️ schedules가 배열이 아닙니다:', rawSchedules);
    return [];
  }

  // 🔍 디버깅: 원본 데이터 상태 확인
  console.log('🔍 원본 schedules 데이터:', {
    총개수: rawSchedules.length,
    샘플: rawSchedules.slice(0, 3),
    ID없는항목: rawSchedules.filter(s => !s?.id).length,
    중복가능성: rawSchedules.length - new Set(rawSchedules.map(s => s?.id)).size
  });

  // Step 1: ID가 없거나 유효하지 않은 항목 필터링
  const withValidIds = rawSchedules.filter(schedule => {
    if (!schedule) {
      console.warn('❌ null/undefined schedule 발견');
      return false;
    }
    
    if (!schedule.id || schedule.id === '' || schedule.id === null) {
      console.warn('❌ ID가 없는 schedule:', schedule);
      return false;
    }
    
    return true;
  });

  // Step 2: 중복 ID 제거 (첫 번째 것만 유지)
  const deduplicatedSchedules = withValidIds.filter((schedule, index, array) => {
    const firstIndex = array.findIndex(s => s.id === schedule.id);
    
    if (firstIndex !== index) {
      console.warn(`🚨 중복 ID "${schedule.id}" 제거:`, schedule);
      return false;
    }
    
    return true;
  });

  // Step 3: 빈 ID나 잘못된 형식 재검증
  const finalSchedules = deduplicatedSchedules.map(schedule => {
    // ID가 문자열이 아니면 문자열로 변환
    if (typeof schedule.id !== 'string') {
      console.warn('⚠️ ID가 문자열이 아님, 변환:', schedule.id);
      schedule.id = String(schedule.id);
    }
    
    // 필수 필드 기본값 설정
    return {
      id: schedule.id,
      title: schedule.title || '제목 없음',
      start: schedule.start || '09:00',
      end: schedule.end || '10:00',
      date: schedule.date || new Date().toISOString().split('T')[0],
      tag: schedule.tag || '',
      tagType: schedule.tagType || '',
      description: schedule.description || '',
      done: Boolean(schedule.done),
      ...schedule // 나머지 필드 유지
    };
  });

  // 🔍 최종 결과 로깅
  console.log('✅ 안전한 schedules 생성 완료:', {
    원본개수: rawSchedules.length,
    최종개수: finalSchedules.length,
    제거된개수: rawSchedules.length - finalSchedules.length,
    최종ID들: finalSchedules.map(s => s.id)
  });

  return finalSchedules;
};

// 디버깅 훅
const useScheduleDebugging = (safeSchedules) => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    console.log('🔍 WeeklyCalendarUI 렌더링 시 데이터 검증');
    
    if (!Array.isArray(safeSchedules)) {
      console.error('❌ safeSchedules가 배열이 아닙니다:', safeSchedules);
      return;
    }

    // ID 중복 재검사
    const ids = safeSchedules.map(s => s.id);
    const uniqueIds = [...new Set(ids)];
    
    if (ids.length !== uniqueIds.length) {
      console.error('🚨 UI 렌더링 시점에도 중복 ID 발견!');
      
      // 중복된 ID들 찾기
      const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx);
      const uniqueDuplicates = [...new Set(duplicates)];
      
      console.error('중복된 ID들:', uniqueDuplicates);
      
      // 각 중복 ID의 상세 정보
      uniqueDuplicates.forEach(dupId => {
        const conflictSchedules = safeSchedules.filter(s => s.id === dupId);
        console.error(`ID "${dupId}"의 충돌 일정들:`, conflictSchedules);
      });
    } else {
      console.log('✅ 모든 schedule ID가 고유함');
    }

    // 빈 값 검사
    const invalidSchedules = safeSchedules.filter(s => 
      !s.id || s.id === '' || !s.title || !s.start || !s.end
    );
    
    if (invalidSchedules.length > 0) {
      console.warn('⚠️ 일부 필수 필드가 없는 일정들:', invalidSchedules);
    }

  }, [safeSchedules]);
};

export const WeeklyCalendarUI = ({ 
  calendarLogic,
  currentUser,
  onLogout,
  // 추가 핸들러들을 props로 받음
  handleContextMenu,
  handleCopySchedule,
  handleDeleteSchedule,
  handleCopyMove,
  handleCopyEnd,
  handleDragStart,
  handleDragMove,
  handleDragEnd,
  handleAdd,
  handleAddTag,
  handleDeleteTagItem,
  handleSelectTag,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek,
  handleTimeSlotClick,
  handleWeekdaySelect,
  // ✨ 서버 기반 추가 props
  isAdminView = false,
  saving = false,
  onDataRefresh = null
}) => {
  const navigate = useNavigate();
  
  const {
    // 상태들
    currentWeek,
    focusedDayIndex,
    visibleDays,
    timeSlots,
    form,
    setForm,
    startSlot,
    activeTimeSlot,
    resizing,
    containerRef,
    showOverlapMessage,
    contextMenu,
    setContextMenu,
    copyingSchedule,
    newTagType,
    setNewTagType,
    newTagName,
    setNewTagName,
    selectedTagType,
    dragging,
    dragOffset,
    autoScrollTimer,
    
    // 계산된 값들
    safeSchedules: rawSafeSchedules,
    safeTags,
    safeTagItems,
    tagTotals,
    repeatOptions,
    intervalOptions,
    
    // 상수들
    SLOT_HEIGHT,
    DAYS_OF_WEEK,
    
    // 헬퍼 함수들
    parseTimeToMinutes,
    getCurrentTimeLine,
    handleDayFocus,
    calculateSlotPosition,
    getTagColor,
    filterSchedulesByDate,
    formatDate,
    getDayOfWeek,
    
    // 이벤트 핸들러들
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd
  } = calendarLogic;

  // 🔧 안전한 schedules 생성 - 서버 데이터 검증 및 중복 제거
  const safeSchedules = React.useMemo(() => {
    return createSafeSchedules(rawSafeSchedules || []);
  }, [rawSafeSchedules]);

  // 🔍 디버깅 훅 사용
  useScheduleDebugging(safeSchedules);

  // ✨ 체크박스 변경 핸들러 - useCallback 완전 제거하여 무한 루프 방지
  const handleCheckboxChange = (scheduleId, currentDone) => {
    if (isAdminView) return;
    
    // setSchedules 함수를 직접 참조하지 않고 콜백으로 처리
    const updateSchedule = calendarLogic.setSchedules;
    if (updateSchedule && currentUser) {
      // 현재 schedules를 직접 가져와서 업데이트
      const currentSchedules = safeSchedules;
      const updated = currentSchedules.map(item =>
        item.id === scheduleId ? { ...item, done: !currentDone } : item
      );
      updateSchedule(updated);
    }
  };

  // 이벤트 리스너 등록 - 의존성 배열 최적화
  useEffect(() => {
    const cleanup = [];

    if (resizing) {
      const moveHandler = (e) => handleResizeMove(e);
      const endHandler = (e) => handleResizeEnd(e);
      
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('mouseup', endHandler);
      cleanup.push(() => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', endHandler);
      });
    }
    
    if (copyingSchedule) {
      const moveHandler = (e) => handleCopyMove(e);
      const endHandler = (e) => handleCopyEnd(e);
      
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('mouseup', endHandler);
      cleanup.push(() => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', endHandler);
      });
    }
    
    if (dragging) {
      const moveHandler = (e) => handleDragMove(e);
      const endHandler = (e) => handleDragEnd(e);
      
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('mouseup', endHandler);
      cleanup.push(() => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', endHandler);
      });
    }
    
    if (contextMenu.visible) {
      const handleClickOutside = () => {
        setContextMenu({ ...contextMenu, visible: false });
      };
      window.addEventListener('click', handleClickOutside);
      cleanup.push(() => {
        window.removeEventListener('click', handleClickOutside);
      });
    }
    
    return () => {
      cleanup.forEach(fn => fn());
      if (autoScrollTimer) {
        clearTimeout(autoScrollTimer);
      }
    };
  }, [
    resizing, 
    copyingSchedule, 
    dragging, 
    contextMenu.visible, 
    autoScrollTimer
    // 🚨 핸들러 함수들을 의존성에서 제거하여 무한 루프 방지
  ]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* 중복 알림 메시지 */}
      {showOverlapMessage && (
        <div className="fixed top-4 right-4 bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-md z-50">
          일정이 다른 일정과 겹칩니다
        </div>
      )}
      
      {/* 복사 모드 안내 메시지 */}
      {copyingSchedule && !isAdminView && (
        <div className="fixed top-4 left-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-md z-50">
          📋 복사 모드: "{copyingSchedule.title}" - 원하는 위치에 클릭하세요
        </div>
      )}
      
      {/* 오른쪽 클릭 메뉴 */}
      {contextMenu.visible && (
        <div 
          className="fixed bg-white shadow-lg rounded-lg overflow-hidden z-50 border"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {!isAdminView && (
            <div 
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" 
              onClick={handleCopySchedule}
            >
              📋 복사
            </div>
          )}
          {!isAdminView && (
            <div 
              className="px-4 py-2 hover:bg-gray-100 text-red-600 cursor-pointer text-sm" 
              onClick={handleDeleteSchedule}
            >
              🗑️ 삭제
            </div>
          )}
          {isAdminView && (
            <div className="px-4 py-2 text-gray-500 text-sm">
              👑 관리자 모드 (읽기 전용)
            </div>
          )}
        </div>
      )}
      
      {/* 헤더 및 상단 요약바 */}
      <div className="bg-white shadow-sm p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          {/* 왼쪽: Back 버튼 */}
          <button 
            className="text-blue-600 flex items-center font-medium"
            onClick={() => navigate("/calendar")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" className="mr-1">
              <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          
          {/* 가운데: This Week 버튼 */}
          <div className="flex gap-2">
            <button 
              className="bg-gray-100 rounded-lg px-3 py-1 text-sm"
              onClick={goToPreviousWeek}
            >
              &lt;
            </button>
            <button 
              className="bg-blue-100 text-blue-700 rounded-lg px-3 py-1 text-sm font-medium"
              onClick={goToCurrentWeek}
            >
              This Week
            </button>
            <button 
              className="bg-gray-100 rounded-lg px-3 py-1 text-sm"
              onClick={goToNextWeek}
            >
              &gt;
            </button>
          </div>
          
          {/* 오른쪽: 날짜 + 사용자 정보 */}
          <div className="flex items-center gap-4">
            <div className="text-gray-800 font-semibold">
              {currentWeek && currentWeek.length >= 7 && 
                `${formatDate(currentWeek[0])} - ${formatDate(currentWeek[6])}`}
            </div>
            {currentUser && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>{isAdminView ? '👑' : '🧑‍💻'} {currentUser}</span>
                {isAdminView && <span className="text-red-500 text-xs">(읽기 전용)</span>}
                {saving && <span className="text-orange-500 text-xs">💾 저장중</span>}
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-red-500 hover:text-red-700 underline"
                  >
                    로그아웃
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* 태그별 총 시간 요약 */}
        <div className="flex gap-4 flex-wrap">
          {Object.entries(tagTotals || {}).map(([tagType, totalTime]) => {
            const tagColor = getTagColor(tagType);
            return (
              <div 
                key={`tag-total-${tagType}`} // 🔧 고유한 key 보장
                className={`${tagColor.bg} ${tagColor.text} rounded-lg px-3 py-1 text-sm font-medium flex items-center`}
              >
                <span>{tagType}</span>
                <span className="ml-2 font-bold">{totalTime}</span>
              </div>
            );
          })}
          {isAdminView && (
            <div className="bg-red-100 text-red-800 rounded-lg px-3 py-1 text-sm font-medium flex items-center">
              👑 관리자 모드
            </div>
          )}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 캘린더 그리드 */}
        <div className="flex-1 flex overflow-hidden">
          <div 
            ref={containerRef}
            className="flex-1 overflow-y-auto relative"
            style={{ height: 'calc(100vh - 100px)' }}
          >
            <div className="flex flex-col">
              {/* 상단 헤더 */}
              <div className="sticky top-0 z-10 flex bg-white border-b border-gray-200">
                <div className="w-10 flex-shrink-0 bg-white border-r border-gray-200" />
                {visibleDays && visibleDays.map((dayIndex, i) => {
                  const date = currentWeek && currentWeek[dayIndex];
                  if (!date) return null; // 🔧 안전 가드
                  
                  const isFocusDay = i === 3;
                  return (
                    <div
                      key={`header-day-${dayIndex}-${i}`} // 🔧 더 고유한 key
                      className={`p-2 text-center border-l border-gray-200 cursor-pointer ${
                        isFocusDay ? 'bg-blue-50 font-bold' : 'bg-white'
                      }`}
                      style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                      onClick={() => handleDayFocus(dayIndex)}
                    >
                      <div>{getDayOfWeek(date)}</div>
                      <div className="text-sm">{formatDate(date)}</div>
                    </div>
                  );
                })}
              </div>

              {/* 콘텐츠 */}
              <div className="flex">
                {/* 시간 열 */}
                <div className="w-10 flex-shrink-0 relative" style={{ height: `${SLOT_HEIGHT * 48}px` }}>
                  {timeSlots && timeSlots.map((time, i) => (
                    <div
                      key={`time-slot-${time}-${i}`} // 🔧 더 고유한 key
                      className="absolute w-full pl-2 text-xs text-gray-500"
                      style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                    >
                      <div className="text-right pr-1">{time}</div>
                    </div>
                  ))}
                </div>

                {/* 날짜 열들 */}
                <div className="flex flex-1 min-w-0">
                  {visibleDays && visibleDays.map((dayIndex, i) => {
                    const date = currentWeek && currentWeek[dayIndex];
                    if (!date) return null; // 🔧 안전 가드
                    
                    const isFocusDay = i === 3;
                    const dateSchedules = filterSchedulesByDate(safeSchedules || [], date);

                    return (
                      <div
                        key={`day-column-${dayIndex}-${formatDate(date)}`} // 🔧 날짜 포함한 고유 key
                        data-day-index={dayIndex}
                        className="relative border-l border-gray-200 flex flex-col transition-all duration-300"
                        style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                      >
                        {/* 시간 슬롯 + 일정 */}
                        <div
                          className={`flex-1 relative ${isFocusDay ? 'bg-blue-50 bg-opacity-30' : ''}`}
                          style={{ height: `${SLOT_HEIGHT * 48}px` }}
                        >
                          {timeSlots && timeSlots.map((time, i) => (
                            <div
                              key={`time-grid-${dayIndex}-${time}-${i}`} // 🔧 더 고유한 key
                              className={`absolute w-full border-t border-gray-200 border-dashed ${
                                activeTimeSlot === time && isFocusDay && !isAdminView ? 'bg-gray-300 bg-opacity-10' : ''
                              }`}
                              style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                              onClick={() => isFocusDay && !isAdminView && handleTimeSlotClick(time)}
                            />
                          ))}

                          {/* 현재 시간 표시 */}
                          {date.toDateString() === new Date().toDateString() && (
                            <div
                              className="absolute w-full border-t-2 border-red-500 z-10"
                              style={{ top: `${getCurrentTimeLine()}px` }}
                            >
                              <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-500 rounded-full" />
                            </div>
                          )}

                          {/* 일정들 - 🔧 안전한 필터링된 데이터 사용 */}
                          {dateSchedules && dateSchedules.map((s, scheduleIndex) => {
                            // 🔧 이중 안전 가드 - ID가 없으면 건너뛰기
                            if (!s || !s.id) {
                              console.warn('렌더링 시 ID가 없는 일정 발견:', s);
                              return null;
                            }

                            const top = calculateSlotPosition(s.start);
                            const bottom = calculateSlotPosition(s.end);
                            const height = bottom - top;
                            const tagTypeForItem = safeTagItems && safeTagItems.find(item => item.tagName === s.tag)?.tagType || s.tagType;
                            const tagColor = getTagColor(tagTypeForItem);
                            const isDragging = dragging === s.id;

                            return (
                              <div
                                key={`schedule-${s.id}-${formatDate(date)}-${scheduleIndex}`} // 🔧 고유성 강화
                                className="absolute left-0 w-full px-1"
                                style={{ 
                                  top: `${top}px`, 
                                  height: `${height}px`,
                                  zIndex: isDragging ? 50 : 1
                                }}
                              >
                                <div 
                                  className={`h-full flex flex-col text-xs rounded-lg px-2 py-1 shadow ${tagColor.bg} ${tagColor.text} relative overflow-hidden ${
                                    isAdminView ? 'cursor-pointer' : 'cursor-move'
                                  } select-none ${
                                    isDragging ? 'opacity-50 ring-2 ring-blue-400' : 'hover:shadow-md'
                                  } ${isAdminView ? 'border-2 border-red-200' : ''}`}
                                  onMouseDown={(e) => {
                                    if (e.button === 0 && !isAdminView) {
                                      handleDragStart(e, s.id);
                                    }
                                  }}
                                  onContextMenu={(e) => handleContextMenu(e, s.id)}
                                >
                                  {isFocusDay && !isAdminView && (
                                    <>
                                      <div
                                        className="absolute top-0 left-0 right-0 h-3 bg-black bg-opacity-20 cursor-ns-resize rounded-t-lg z-20"
                                        onMouseDown={(e) => {
                                          if (e.button === 0) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleResizeStart(e, s.id, 'top');
                                          }
                                        }}
                                      />
                                      <div
                                        className="absolute bottom-0 left-0 right-0 h-3 bg-black bg-opacity-20 cursor-ns-resize rounded-b-lg z-20"
                                        onMouseDown={(e) => {
                                          if (e.button === 0) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleResizeStart(e, s.id, 'bottom');
                                          }
                                        }}
                                      />
                                    </>
                                  )}

                                  {/* 관리자 모드 표시 */}
                                  {isAdminView && (
                                    <div className="absolute top-1 right-1 text-red-500 text-xs">👑</div>
                                  )}

                                  {/* 첫째줄: 체크박스 + 태그(라운드 네모칸) + 항목명 */}
                                  <div className="flex items-center gap-1 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={s.done || false}
                                      disabled={isAdminView}
                                      className={`flex-shrink-0 ${isAdminView ? 'cursor-not-allowed opacity-50' : 'pointer-events-auto'}`}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleCheckboxChange(s.id, s.done);
                                      }}
                                    />
                                    {s.tag && (
                                      <span className="px-2 py-0.5 text-[10px] bg-white bg-opacity-30 rounded-md font-bold flex-shrink-0">
                                        {tagTypeForItem ? `${tagTypeForItem}` : s.tag}
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-bold truncate ${s.done ? "line-through opacity-60" : ""}`}>
                                      {s.tag ? s.tag : ''}
                                    </span>
                                  </div>

                                  {/* 둘째줄: 시간 표기 */}
                                  <div className="text-[12px] mb-1 opacity-80">
                                    {s.start} - {s.end}
                                  </div>

                                  {/* 셋째줄: 일정명 */}
                                  <div className={`text-[11px] font-bold mb-1 truncate ${s.done ? "line-through opacity-60" : ""}`}>
                                    {s.title}
                                  </div>

                                  {/* 넷째줄: 일정 내용 */}
                                  {s.description && (
                                    <div className="text-[9px] opacity-70 flex-1 overflow-hidden">
                                      <div className="line-clamp-2">
                                        {s.description}
                                      </div>
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
            </div>
          </div>
        </div>
        
        {/* 오른쪽: 입력 폼 */}
        <div className={`w-80 border-l border-gray-200 bg-white overflow-hidden p-4 ${
          isAdminView ? 'bg-gray-50 opacity-75' : ''
        }`}>
          <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold mt-2 mb-4">
              {isAdminView ? '일정 조회' : '일정 추가'}
              {isAdminView && <span className="text-sm text-red-500 ml-2">(읽기 전용)</span>}
            </h2>
            
            {isAdminView ? (
              /* 관리자 모드 - 읽기 전용 안내 */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="text-6xl text-gray-400 mb-4">👑</div>
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">관리자 모드</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    <strong>{currentUser}님</strong>의 일정을 읽기 전용으로 조회하고 있습니다.
                  </p>
                  <div className="bg-red-50 rounded-lg p-4 text-left">
                    <h4 className="font-medium text-red-800 mb-2">제한 사항</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• 일정 추가/수정/삭제 불가</li>
                      <li>• 태그 관리 불가</li>
                      <li>• 드래그 앤 드롭 불가</li>
                      <li>• 리사이즈 불가</li>
                    </ul>
                  </div>
                  {onDataRefresh && (
                    <button
                      onClick={onDataRefresh}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      🔄 서버 새로고침
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* 일반 모드 - 편집 가능한 폼 */
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-4">
                  <input
                    type="text"
                    placeholder="일정 명을 적어주세요."
                    className="w-full bg-gray-50 border-0 border-b border-gray-200 px-2 py-2 mb-3 focus:outline-none focus:border-gray-400"
                    value={form.title || ""}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                  
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1 relative">
                      <div className="flex items-center border rounded-md p-2 bg-white">
                        <div className="w-6 h-6 flex items-center justify-center">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <select
                          className="ml-2 w-full bg-transparent border-0 focus:outline-none appearance-none"
                          value={startSlot || ""}
                          onChange={(e) => calendarLogic.setStartSlot(e.target.value)}
                        >
                          {timeSlots && timeSlots.map((time, index) => (
                            <option key={`start-time-${time}-${index}`} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex-1 relative">
                      <div className="flex items-center border rounded-md p-2 bg-white">
                        <div className="w-6 h-6 flex items-center justify-center">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <select
                          className="ml-2 w-full bg-transparent border-0 focus:outline-none appearance-none"
                          value={form.end || ""}
                          onChange={(e) => setForm({ ...form, end: e.target.value })}
                        >
                          {timeSlots && timeSlots
                            .filter((t) => !startSlot || parseTimeToMinutes(t) > parseTimeToMinutes(startSlot))
                            .map((time, index) => (
                              <option key={`end-time-${time}-${index}`} value={time}>{time}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  
                  <textarea
                    placeholder="내용을 적어주세요"
                    className="w-full h-24 bg-white border rounded-md p-3 mb-3 focus:outline-none focus:border-gray-400 resize-none"
                    value={form.description || ""}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  ></textarea>
                  
                  {/* 반복 옵션 영역 */}
                  <div className="mb-3">
                    <h3 className="font-medium mb-2">반복 설정</h3>
                    
                    <div className="flex gap-2 mb-2">
                      {/* 반복 횟수 */}
                      <select
                        className="flex-1 border rounded-md p-2 text-xs"
                        value={form.repeatCount || "1"}
                        onChange={(e) => setForm({ ...form, repeatCount: e.target.value })}
                      >
                        <option value="1">반복 없음</option>
                        {repeatOptions && repeatOptions.map((count) => (
                          <option key={`repeat-${count}`} value={count}>
                            {count}번 반복
                          </option>
                        ))}
                      </select>

                      {/* 주기 설정 */}
                      <select
                        className="flex-1 border rounded-md p-2 text-xs"
                        value={form.interval || ""}
                        onChange={(e) => setForm({ ...form, interval: e.target.value })}
                      >
                        {intervalOptions && intervalOptions.map((opt) => (
                          <option key={`interval-${opt.value}`} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 요일 선택 */}
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK && DAYS_OF_WEEK.map((day, idx) => {
                        const selected = form.weekdays && form.weekdays.includes(day);
                        return (
                          <button
                            key={`weekday-${day}-${idx}`} // 🔧 고유한 key
                            type="button"
                            className={`w-7 h-7 rounded-full border text-xs font-medium transition ${
                              selected
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                            onClick={() => handleWeekdaySelect(day)}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-3">
                    <h3 className="font-medium mb-2">태그 선택</h3>
                    <div className="h-48 overflow-y-auto pr-1 border rounded-md p-3 bg-white">
                      {safeTagItems && safeTagItems.map((item, idx) => {
                        const tagGroup = safeTags && safeTags.find(t => t.tagType === item.tagType);
                        const tagColor = tagGroup ? tagGroup.color : { bg: "bg-gray-100", text: "text-gray-800" };
                        
                        return (
                          <div key={`tag-item-${item.tagType}-${item.tagName}-${idx}`} className="flex items-center mb-2 last:mb-0">
                            <div className={`w-16 ${tagColor.bg} ${tagColor.text} px-2 py-1 rounded-l-md text-xs font-medium truncate`}>
                              {item.tagType}
                            </div>
                            <div 
                              className={`flex-1 ${tagColor.bg} ${tagColor.text} px-2 py-1 text-xs cursor-pointer hover:bg-opacity-80 ${selectedTagType === item.tagType && form.tag === item.tagName ? 'ring-1 ring-blue-400' : ''}`}
                              onClick={() => handleSelectTag(item.tagType, item.tagName)}
                            >
                              {item.tagName}
                            </div>
                            <button 
                              className="bg-red-100 text-red-500 rounded-r-md px-2 py-1 text-xs"
                              onClick={() => handleDeleteTagItem(item.tagType, item.tagName)}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      {(!safeTagItems || safeTagItems.length === 0) && (
                        <div className="text-center text-gray-500 py-15 text-sm">
                          태그를 추가해주세요
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 mb-1">
                    <input
                      type="text"
                      placeholder="태그"
                      className="w-16 text-xs bg-white border rounded-l-md px-2 py-1 focus:outline-none focus:border-gray-400"
                      value={newTagType || ""}
                      onChange={(e) => setNewTagType(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="항목 이름"
                      className="flex-1 text-xs bg-white border-y border-r-0 px-2 py-1 focus:outline-none focus:border-gray-400"
                      value={newTagName || ""}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                    <button 
                      className="bg-gray-200 w-8 h-6 rounded-r-md flex items-center justify-center text-sm font-bold hover:bg-gray-300 transition-colors"
                      onClick={handleAddTag}
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  className={`w-full text-center py-3 rounded-lg text-xl font-medium transition-colors ${
                    saving 
                      ? 'bg-orange-100 text-orange-800 cursor-not-allowed' 
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                  onClick={handleAdd}
                  disabled={saving}
                >
                  {saving ? '💾 서버에 저장 중...' : '일정 추가하기'}
                </button>

                {/* 서버 상태 안내 */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center text-blue-800 text-sm">
                    <span className="mr-2">🌐</span>
                    <span className="font-medium">100% 서버 기반</span>
                  </div>
                  <p className="text-blue-700 text-xs mt-1">
                    모든 변경사항이 Supabase 서버에 실시간 저장됩니다
                  </p>
                </div>

                {/* 🔍 개발 모드 디버깅 정보 */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center text-yellow-800 text-sm mb-2">
                      <span className="mr-2">🔧</span>
                      <span className="font-medium">개발 모드 디버깅</span>
                    </div>
                    <div className="text-yellow-700 text-xs space-y-1">
                      <div>총 일정: {safeSchedules?.length || 0}개</div>
                      <div>안전 필터링 완료: ✅</div>
                      <div>중복 ID 제거: ✅</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
