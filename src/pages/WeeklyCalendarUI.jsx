// WeeklyCalendarUI.jsx - 기존 구조 유지하면서 필요한 기능만 추가
import React, { useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

// ✅ 기존 컴포넌트들 유지
const SyncStatusDisplay = React.memo(({ isLoading, isSaving, lastSyncTime }) => {
  if (isSaving) {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-orange-100 text-orange-800 px-4 py-2 rounded-lg shadow-md z-50 flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
        💾 서버에 저장 중...
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-md z-50 flex items-center">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
        🔄 서버 데이터 동기화 중...
      </div>
    );
  }
  
  return null;
});

const OverlapMessage = React.memo(({ showOverlapMessage }) => {
  if (!showOverlapMessage) return null;
  
  return (
    <div className="fixed top-4 right-4 bg-red-100 text-red-800 px-4 py-2 rounded-lg shadow-md z-50">
      일정이 다른 일정과 겹칩니다
    </div>
  );
});

const CopyModeMessage = React.memo(({ copyingSchedule }) => {
  if (!copyingSchedule) return null;
  
  return (
    <div className="fixed top-4 left-4 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-md z-50">
      📋 복사 모드: "{copyingSchedule.title}" - 원하는 위치에 클릭하세요
    </div>
  );
});

// 🔧 개선된 컨텍스트 메뉴 (복사 기능 강화)
const ContextMenu = React.memo(({ contextMenu, handleCopySchedule, handleDeleteSchedule }) => {
  if (!contextMenu.visible) return null;
  
  return (
    <div 
      className="fixed bg-white shadow-lg rounded-lg overflow-hidden z-50 border"
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <div 
        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" 
        onClick={handleCopySchedule}
      >
        📋 복사
      </div>
      <div 
        className="px-4 py-2 hover:bg-gray-100 text-red-600 cursor-pointer text-sm" 
        onClick={handleDeleteSchedule}
      >
        🗑️ 삭제
      </div>
    </div>
  );
});

// ✅ 문제 1 해결: 월별 태그 요약 컴포넌트 수정
const TagSummary = React.memo(({ tagTotals, getTagColor, currentMonth }) => {
  const tagEntries = Object.entries(tagTotals);
  
  const monthTitle = currentMonth ? `${currentMonth.year}년 ${currentMonth.month}월` : '이번 달';
  
  if (tagEntries.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        {monthTitle} 등록된 일정이 없습니다
      </div>
    );
  }
  
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-gray-700">
        📊 {monthTitle} 태그별 시간 총합
      </div>
      <div className="flex gap-4 flex-wrap">
        {tagEntries.map(([tagType, totalTime]) => {
          const tagColor = getTagColor(tagType);
          return (
            <div 
              key={tagType} 
              className={`${tagColor.bg} ${tagColor.text} rounded-lg px-3 py-1 text-sm font-medium flex items-center`}
            >
              <span>{tagType}</span>
              <span className="ml-2 font-bold">{totalTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// 🔧 요일 선택 컴포넌트 수정 - DAYS_OF_WEEK 기본값 추가
const WeekdaySelector = React.memo(({ form, setForm, handleWeekdaySelect, DAYS_OF_WEEK }) => {
  // 🔧 DAYS_OF_WEEK가 없거나 빈 배열인 경우 기본값 사용
  const defaultDaysOfWeek = ["일", "월", "화", "수", "목", "금", "토"];
  const daysToUse = (DAYS_OF_WEEK && DAYS_OF_WEEK.length > 0) ? DAYS_OF_WEEK : defaultDaysOfWeek;
  
  // 🔍 디버깅 로그
  console.log('🔍 WeekdaySelector - DAYS_OF_WEEK:', DAYS_OF_WEEK);
  console.log('🔍 WeekdaySelector - daysToUse:', daysToUse);

  return (
    <div className="mb-3">
      <h3 className="font-medium mb-2">반복 요일 선택</h3>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {daysToUse.map(weekday => (
          <button
            key={weekday}
            onClick={() => handleWeekdaySelect(weekday)}
            className={`w-8 h-8 text-xs font-medium rounded-full transition-colors ${
              form.weekdays?.includes(weekday)
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {weekday}
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-500">
        {form.weekdays?.length > 0 
          ? `선택된 요일: ${form.weekdays.join(', ')}`
          : '선택된 요일이 없으면 현재 요일에만 추가됩니다'
        }
      </div>
    </div>
  );
});

// 🔧 반복 설정 컴포넌트 추가
const RepeatSettings = React.memo(({ form, setForm, handleIntervalChange, handleRepeatCountChange }) => {
  const INTERVAL_OPTIONS = [
    { value: 1, label: '매주' },
    { value: 2, label: '2주마다' },
    { value: 3, label: '3주마다' },
    { value: 4, label: '4주마다' }
  ];

  const REPEAT_COUNT_OPTIONS = [
    { value: 1, label: '1회' },
    { value: 2, label: '2회' },
    { value: 3, label: '3회' },
    { value: 4, label: '4회' },
    { value: 5, label: '5회' },
    { value: 8, label: '8회' },
    { value: 10, label: '10회' },
    { value: 12, label: '12회' },
    { value: 16, label: '16회' }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          반복 간격
        </label>
        <select
          value={form.interval || "1"}
          onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
          className="w-full text-xs bg-white border rounded-md px-2 py-1 focus:outline-none focus:border-blue-400"
        >
          {INTERVAL_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          반복 횟수
        </label>
        <select
          value={form.repeatCount || "1"}
          onChange={(e) => handleRepeatCountChange(parseInt(e.target.value))}
          className="w-full text-xs bg-white border rounded-md px-2 py-1 focus:outline-none focus:border-blue-400"
        >
          {REPEAT_COUNT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

// 기존 컴포넌트들 유지 (TimeSlotGrid, DayColumn, ScheduleItem)
const TimeSlotGrid = React.memo(({ 
  timeSlots, 
  SLOT_HEIGHT, 
  visibleDays, 
  safeSchedules,
  filterSchedulesByDate,
  calculateSlotPosition,
  getTagColor,
  safeTagItems,
  getCurrentTimeLine,
  activeTimeSlot,
  handleTimeSlotClick,
  handleDayFocus,
  handleDragStart,
  handleContextMenu,
  handleResizeStart,
  handleCheckboxChange,
  dragging,
  isServerBased,
  currentUser
}) => {
  return (
    <div className="flex">
      {/* 시간 열 */}
      <div className="w-10 flex-shrink-0 relative" style={{ height: `${SLOT_HEIGHT * 48}px` }}>
        {timeSlots.map((time, i) => (
          <div
            key={time}
            className="absolute w-full pl-2 text-xs text-gray-500"
            style={{ top: `${i * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
          >
            <div className="text-right pr-1">{time}</div>
          </div>
        ))}
      </div>

      {/* 날짜 열들 */}
      <div className="flex flex-1 min-w-0">
        {visibleDays.map((date, i) => {
          const isFocusDay = i === 2;
          const isToday = date.toDateString() === new Date().toDateString();
          const dateSchedules = filterSchedulesByDate(safeSchedules, date);

          return (
            <DayColumn
              key={`${date.toISOString()}-${i}`}
              date={date}
              dayIndex={i}
              isFocusDay={isFocusDay}
              isToday={isToday}
              dateSchedules={dateSchedules}
              timeSlots={timeSlots}
              SLOT_HEIGHT={SLOT_HEIGHT}
              activeTimeSlot={activeTimeSlot}
              handleTimeSlotClick={handleTimeSlotClick}
              handleDayFocus={handleDayFocus}
              getCurrentTimeLine={getCurrentTimeLine}
              calculateSlotPosition={calculateSlotPosition}
              getTagColor={getTagColor}
              safeTagItems={safeTagItems}
              handleDragStart={handleDragStart}
              handleContextMenu={handleContextMenu}
              handleResizeStart={handleResizeStart}
              handleCheckboxChange={handleCheckboxChange}
              dragging={dragging}
              isServerBased={isServerBased}
              currentUser={currentUser}
            />
          );
        })}
      </div>
    </div>
  );
});

const DayColumn = React.memo(({ 
  date,
  dayIndex,
  isFocusDay,
  isToday,
  dateSchedules,
  timeSlots,
  SLOT_HEIGHT,
  activeTimeSlot,
  handleTimeSlotClick,
  handleDayFocus,
  getCurrentTimeLine,
  calculateSlotPosition,
  getTagColor,
  safeTagItems,
  handleDragStart,
  handleContextMenu,
  handleResizeStart,
  handleCheckboxChange,
  dragging,
  isServerBased,
  currentUser
}) => {
  const handleDayClick = useCallback(() => {
    handleDayFocus(date);
  }, [date, handleDayFocus]);

  const handleTimeClick = useCallback((time) => {
    if (isFocusDay && handleTimeSlotClick) {
      console.log('🕐 시간 슬롯 클릭:', time);
      handleTimeSlotClick(time);
    }
  }, [isFocusDay, handleTimeSlotClick]);

  return (
    <div
      data-day-index={dayIndex}
      className={`relative border-l border-gray-200 flex flex-col transition-all duration-300 ${
        isToday ? 'border-blue-300 border-2' : ''
      }`}
      style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
    >
      <div
        className={`flex-1 relative ${
          isFocusDay ? 'bg-blue-50 bg-opacity-30' : ''
        } ${isToday ? 'bg-blue-50 bg-opacity-20' : ''}`}
        style={{ height: `${SLOT_HEIGHT * 48}px` }}
      >
        {/* 시간 슬롯 */}
        {timeSlots.map((time, timeIndex) => (
          <div
            key={time}
            className={`absolute w-full border-t border-gray-200 border-dashed transition-colors ${
              isFocusDay 
                ? 'hover:bg-blue-200 hover:bg-opacity-50 cursor-pointer' 
                : 'hover:bg-gray-100 hover:bg-opacity-30'
            } ${
              activeTimeSlot === time && isFocusDay ? 'bg-blue-300 bg-opacity-30' : ''
            }`}
            style={{ top: `${timeIndex * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
            onClick={() => handleTimeClick(time)}
            title={isFocusDay ? `${time} 시간 슬롯 선택` : `${time}`}
          />
        ))}

        {/* 현재 시간 표시 */}
        {isToday && (
          <div
            className="absolute w-full border-t-2 border-red-500 z-10"
            style={{ top: `${getCurrentTimeLine()}px` }}
          >
            <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-500 rounded-full" />
          </div>
        )}

        {/* 일정들 */}
        {dateSchedules.map((schedule) => (
          <ScheduleItem
            key={schedule.id}
            schedule={schedule}
            isFocusDay={isFocusDay}
            calculateSlotPosition={calculateSlotPosition}
            getTagColor={getTagColor}
            safeTagItems={safeTagItems}
            handleDragStart={handleDragStart}
            handleContextMenu={handleContextMenu}
            handleResizeStart={handleResizeStart}
            handleCheckboxChange={handleCheckboxChange}
            dragging={dragging}
            isServerBased={isServerBased}
            currentUser={currentUser}
          />
        ))}
      </div>
    </div>
  );
});

// ✅ 문제 2 해결: 드래그 앤 드롭 및 복사 기능 개선
const ScheduleItem = React.memo(({ 
  schedule,
  isFocusDay,
  calculateSlotPosition,
  getTagColor,
  safeTagItems,
  handleDragStart,
  handleContextMenu,
  handleResizeStart,
  handleCheckboxChange,
  dragging,
  isServerBased,
  currentUser
}) => {
  const top = calculateSlotPosition(schedule.start);
  const bottom = calculateSlotPosition(schedule.end);
  const height = bottom - top;
  const tagTypeForItem = safeTagItems.find(item => item.tagName === schedule.tag)?.tagType || schedule.tagType;
  const tagColor = getTagColor(tagTypeForItem);
  const isDragging = dragging === schedule.id;

  // ✅ 문제 2 해결: 마우스 이벤트 핸들러 개선 - 드래그 기능 강화
  const handleMouseDown = useCallback((e) => {
    if (e.button === 0 && isFocusDay) { // 좌클릭이고 포커스된 날짜에서만
      // 리사이즈 핸들 영역이 아닌 경우에만 드래그 시작
      const target = e.target;
      const isResizeHandle = target.classList.contains('resize-handle') || 
                           target.closest('.resize-handle');
      const isCheckbox = target.type === 'checkbox' || target.closest('input[type="checkbox"]');
      
      if (!isResizeHandle && !isCheckbox) {
        console.log('🖱️ 스케줄 드래그 시작:', schedule.id, schedule.title);
        e.preventDefault();
        e.stopPropagation();
        handleDragStart(e, schedule.id);
      }
    }
  }, [handleDragStart, schedule.id, schedule.title, isFocusDay]);

  const handleRightClick = useCallback((e) => {
    console.log('🖱️ 스케줄 우클릭:', schedule.id, schedule.title);
    e.preventDefault();
    e.stopPropagation();
    handleContextMenu(e, schedule.id);
  }, [handleContextMenu, schedule.id, schedule.title]);

  const handleTopResize = useCallback((e) => {
    if (e.button === 0 && isFocusDay) {
      console.log('🔧 상단 리사이즈 시작:', schedule.id);
      e.preventDefault();
      e.stopPropagation();
      handleResizeStart(e, schedule.id, 'top');
    }
  }, [handleResizeStart, schedule.id, isFocusDay]);

  const handleBottomResize = useCallback((e) => {
    if (e.button === 0 && isFocusDay) {
      console.log('🔧 하단 리사이즈 시작:', schedule.id);
      e.preventDefault();
      e.stopPropagation();
      handleResizeStart(e, schedule.id, 'bottom');
    }
  }, [handleResizeStart, schedule.id, isFocusDay]);

  const handleCheckboxClick = useCallback((e) => {
    console.log('☑️ 체크박스 클릭:', schedule.id, !schedule.done);
    e.stopPropagation();
    e.preventDefault();
    handleCheckboxChange(schedule.id, schedule.done);
  }, [handleCheckboxChange, schedule.id, schedule.done]);

  return (
    <div
      className="absolute left-0 w-full px-1"
      style={{ 
        top: `${top}px`, 
        height: `${height}px`,
        zIndex: isDragging ? 50 : 1
      }}
    >
      <div 
        className={`h-full flex flex-col text-xs rounded-lg px-2 py-1 shadow ${tagColor.bg} ${tagColor.text} relative overflow-hidden select-none transition-all ${
          isDragging ? 'opacity-50 ring-2 ring-blue-400 scale-105' : 'hover:shadow-md hover:scale-105'
        } ${schedule.done ? 'opacity-70' : ''} ${
          isFocusDay ? 'cursor-move' : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onContextMenu={handleRightClick}
        title={isFocusDay ? '드래그로 이동 가능, 우클릭으로 메뉴' : '포커스된 날짜에서 이동 가능'}
        draggable={false} // HTML5 드래그 비활성화, 커스텀 드래그 사용
      >
        {/* ✅ 리사이즈 핸들 - 포커스된 날짜에서만 표시 */}
        {isFocusDay && (
          <>
            <div
              className="resize-handle absolute top-0 left-0 right-0 h-3 bg-black bg-opacity-20 cursor-ns-resize rounded-t-lg z-20 hover:bg-opacity-30"
              onMouseDown={handleTopResize}
              title="상단 드래그로 시작 시간 조정"
            />
            <div
              className="resize-handle absolute bottom-0 left-0 right-0 h-3 bg-black bg-opacity-20 cursor-ns-resize rounded-b-lg z-20 hover:bg-opacity-30"
              onMouseDown={handleBottomResize}
              title="하단 드래그로 종료 시간 조정"
            />
          </>
        )}

        {/* 첫째줄: 체크박스 + 태그 + 항목명 */}
        <div className="flex items-center gap-1 mb-1">
          <input
            type="checkbox"
            checked={schedule.done}
            className="pointer-events-auto flex-shrink-0 cursor-pointer z-30"
            onChange={handleCheckboxClick}
            onClick={handleCheckboxClick}
            title="완료 상태 토글"
          />
          {schedule.tag && (
            <span className="px-2 py-0.5 text-[10px] bg-white bg-opacity-30 rounded-md font-bold flex-shrink-0">
              {tagTypeForItem ? `${tagTypeForItem}` : schedule.tag}
            </span>
          )}
          <span className={`text-[10px] font-bold truncate ${schedule.done ? "line-through opacity-60" : ""}`}>
            {schedule.tag ? schedule.tag : ''}
          </span>
        </div>

        {/* 둘째줄: 시간 표기 */}
        <div className="text-[12px] mb-1 opacity-80 pointer-events-none">
          {schedule.start} - {schedule.end}
        </div>

        {/* 셋째줄: 일정명 */}
        <div className={`text-[11px] font-bold mb-1 truncate pointer-events-none ${schedule.done ? "line-through opacity-60" : ""}`}>
          {schedule.title}
        </div>

        {/* 넷째줄: 일정 내용 */}
        {schedule.description && (
          <div className="text-[9px] opacity-70 flex-1 overflow-hidden pointer-events-none">
            <div className="line-clamp-2">
              {schedule.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// 🔧 메인 컴포넌트
export const WeeklyCalendarUI = ({ 
  calendarLogic,
  currentUser,
  onLogout,
  isServerBased = true,
  isLoading = false,
  isSaving = false,
  lastSyncTime = null,
  onManualRefresh,
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
  handleIntervalChange,
  handleRepeatCountChange
}) => {
  const navigate = useNavigate();
  
  const {
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
    safeSchedules,
    safeTags,
    safeTagItems,
    tagTotals,
    currentMonth, // ✅ 문제 1 해결용 추가
    SLOT_HEIGHT,
    DAYS_OF_WEEK,
    parseTimeToMinutes,
    getCurrentTimeLine,
    handleDayFocus,
    calculateSlotPosition,
    getTagColor,
    filterSchedulesByDate,
    formatDate,
    getDayOfWeek,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    saveDataToServer
  } = calendarLogic;

  const handleCheckboxChange = useCallback(async (scheduleId, currentDone) => {
    console.log('☑️ 체크박스 상태 변경:', scheduleId, currentDone, '→', !currentDone);
    
    const updatedSchedules = safeSchedules.map(item =>
      item.id === scheduleId ? { ...item, done: !currentDone } : item
    );
    
    if (calendarLogic.setSchedules) {
      calendarLogic.setSchedules(updatedSchedules);
    }
    
    if (isServerBased && currentUser && saveDataToServer) {
      const result = await saveDataToServer({
        schedules: updatedSchedules,
        tags: safeTags,
        tagItems: safeTagItems,
        monthlyGoals: calendarLogic.safeMonthlyGoals
      }, { silent: true, debounceMs: 0 });
      
      if (!result.success) {
        console.error('❌ 체크박스 상태 저장 실패:', result.error);
      } else {
        console.log('✅ 체크박스 상태 저장 완료');
      }
    }
  }, [safeSchedules, safeTags, safeTagItems, calendarLogic, isServerBased, currentUser, saveDataToServer]);

  const handleClickOutside = useCallback(() => {
    setContextMenu({ ...contextMenu, visible: false });
  }, [contextMenu, setContextMenu]);

  // ✅ 문제 2 해결: 이벤트 리스너 개선
  useEffect(() => {
    const cleanup = [];
    
    if (resizing) {
      const handleMouseMove = (e) => handleResizeMove(e);
      const handleMouseUp = (e) => handleResizeEnd(e);
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      cleanup.push(
        () => window.removeEventListener('mousemove', handleMouseMove),
        () => window.removeEventListener('mouseup', handleMouseUp)
      );
    }
    
    if (copyingSchedule) {
      const handleMouseMove = (e) => handleCopyMove(e);
      const handleMouseUp = (e) => handleCopyEnd(e);
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      cleanup.push(
        () => window.removeEventListener('mousemove', handleMouseMove),
        () => window.removeEventListener('mouseup', handleMouseUp)
      );
      console.log('📋 복사 모드 이벤트 리스너 등록');
    }
    
    if (dragging) {
      const handleMouseMove = (e) => handleDragMove(e);
      const handleMouseUp = (e) => handleDragEnd(e);
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      cleanup.push(
        () => window.removeEventListener('mousemove', handleMouseMove),
        () => window.removeEventListener('mouseup', handleMouseUp)
      );
      console.log('🖱️ 드래그 모드 이벤트 리스너 등록');
    }
    
    if (contextMenu.visible) {
      window.addEventListener('click', handleClickOutside);
      cleanup.push(() => window.removeEventListener('click', handleClickOutside));
    }
    
    if (autoScrollTimer) {
      cleanup.push(() => clearTimeout(autoScrollTimer));
    }
    
    return () => {
      cleanup.forEach(fn => fn());
    };
  }, [
    resizing, copyingSchedule, dragging, contextMenu.visible, autoScrollTimer,
    handleResizeMove, handleResizeEnd, handleCopyMove, handleCopyEnd,
    handleDragMove, handleDragEnd, handleClickOutside
  ]);

  const navigationHandlers = useMemo(() => ({
    goToCalendar: () => navigate("/calendar"),
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek
  }), [navigate, goToPreviousWeek, goToNextWeek, goToCurrentWeek]);

  const formHandlers = useMemo(() => ({
    setTitle: (title) => setForm({ ...form, title }),
    setEnd: (end) => setForm({ ...form, end }),
    setDescription: (description) => setForm({ ...form, description }),
    setStartSlot: calendarLogic.setStartSlot
  }), [form, setForm, calendarLogic.setStartSlot]);

  const dateRange = useMemo(() => {
    return `${formatDate(currentWeek[0])} - ${formatDate(currentWeek[6])}`;
  }, [currentWeek, formatDate]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* 상태 메시지들 */}
      <OverlapMessage showOverlapMessage={showOverlapMessage} />
      <CopyModeMessage copyingSchedule={copyingSchedule} />
      <SyncStatusDisplay isLoading={isLoading} isSaving={isSaving} lastSyncTime={lastSyncTime} />
      <ContextMenu 
        contextMenu={contextMenu} 
        handleCopySchedule={handleCopySchedule} 
        handleDeleteSchedule={handleDeleteSchedule} 
      />
      
      {/* 헤더 및 상단 요약바 */}
      <div className="bg-white shadow-sm p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <button 
            className="text-blue-600 flex items-center font-medium hover:text-blue-800 transition-colors"
            onClick={navigationHandlers.goToCalendar}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg" className="mr-1">
              <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          
          <div className="flex gap-2">
            <button 
              className="bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1 text-sm transition-colors"
              onClick={navigationHandlers.goToPreviousWeek}
            >
              &lt;
            </button>
            <button 
              className="bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg px-3 py-1 text-sm font-medium transition-colors"
              onClick={navigationHandlers.goToCurrentWeek}
            >
              This Week
            </button>
            <button 
              className="bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1 text-sm transition-colors"
              onClick={navigationHandlers.goToNextWeek}
            >
              &gt;
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-gray-800 font-semibold">{dateRange}</div>
            {currentUser && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🧑‍💻 {currentUser}</span>
                {isServerBased && (
                  <>
                    <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">🌐 서버 연동</div>
                    {onManualRefresh && (
                      <button
                        onClick={onManualRefresh}
                        disabled={isLoading || isSaving}
                        className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        title="서버에서 새로고침"
                      >
                        {isLoading || isSaving ? '🔄 로딩...' : '🔄 새로고침'}
                      </button>
                    )}
                    {lastSyncTime && !isLoading && !isSaving && (
                      <div className="text-xs text-gray-500">
                        {lastSyncTime.toLocaleTimeString('ko-KR')}
                      </div>
                    )}
                  </>
                )}
                <button onClick={onLogout} className="text-red-500 hover:text-red-700 underline">
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* ✅ 문제 1 해결: 월별 태그 요약 표시 */}
        <TagSummary 
          tagTotals={tagTotals} 
          getTagColor={getTagColor} 
          currentMonth={currentMonth}
        />
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
                {visibleDays.map((date, i) => {
                  const isFocusDay = i === 2;
                  const isToday = date.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={i}
                      className={`p-2 text-center border-l border-gray-200 cursor-pointer transition-colors ${
                        isFocusDay ? 'bg-blue-50 font-bold' : 'bg-white hover:bg-gray-50'
                      } ${isToday ? 'border-blue-300 border-2' : ''}`}
                      style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                      onClick={() => handleDayFocus(date)}
                    >
                      <div className={isToday ? 'text-blue-600 font-bold' : ''}>{getDayOfWeek(date)}</div>
                      <div className={`text-sm ${isToday ? 'text-blue-600 font-bold' : ''}`}>{formatDate(date)}</div>
                    </div>
                  );
                })}
              </div>

              {/* 시간 슬롯 그리드 */}
              <TimeSlotGrid
                timeSlots={timeSlots}
                SLOT_HEIGHT={SLOT_HEIGHT}
                visibleDays={visibleDays}
                safeSchedules={safeSchedules}
                filterSchedulesByDate={filterSchedulesByDate}
                calculateSlotPosition={calculateSlotPosition}
                getTagColor={getTagColor}
                safeTagItems={safeTagItems}
                getCurrentTimeLine={getCurrentTimeLine}
                activeTimeSlot={activeTimeSlot}
                handleTimeSlotClick={handleTimeSlotClick}
                handleDayFocus={handleDayFocus}
                handleDragStart={handleDragStart}
                handleContextMenu={handleContextMenu}
                handleResizeStart={handleResizeStart}
                handleCheckboxChange={handleCheckboxChange}
                dragging={dragging}
                isServerBased={isServerBased}
                currentUser={currentUser}
              />
            </div>
          </div>
        </div>
        
        {/* 🔧 오른쪽: 개선된 입력 폼 (새 기능들 추가) */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-hidden p-4">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">일정 추가</h2>
              {isServerBased && (
                <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  🌐 서버 저장
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1">
              <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-4">
                <input
                  type="text"
                  placeholder="일정 명을 적어주세요."
                  className="w-full bg-gray-50 border-0 border-b border-gray-200 px-2 py-2 mb-3 focus:outline-none focus:border-gray-400"
                  value={form.title}
                  onChange={(e) => formHandlers.setTitle(e.target.value)}
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
                        onChange={(e) => formHandlers.setStartSlot(e.target.value)}
                      >
                        {timeSlots.map(time => (
                          <option key={`start-${time}`} value={time}>{time}</option>
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
                        value={form.end}
                        onChange={(e) => formHandlers.setEnd(e.target.value)}
                      >
                        {timeSlots
                          .filter((t) => !startSlot || parseTimeToMinutes(t) > parseTimeToMinutes(startSlot))
                          .map(time => (
                            <option key={`end-${time}`} value={time}>{time}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
                
                <textarea
                  placeholder="내용을 적어주세요"
                  className="w-full h-24 bg-white border rounded-md p-3 mb-3 focus:outline-none focus:border-gray-400 resize-none"
                  value={form.description || ""}
                  onChange={(e) => formHandlers.setDescription(e.target.value)}
                ></textarea>
                
                {/* ✅ 문제 3 해결: 요일 선택 - DAYS_OF_WEEK 확인 및 전달 */}
                <WeekdaySelector 
                  form={form}
                  setForm={setForm}
                  handleWeekdaySelect={handleWeekdaySelect}
                  DAYS_OF_WEEK={DAYS_OF_WEEK || ["일", "월", "화", "수", "목", "금", "토"]}
                />
                
                {/* 🔧 새로 추가: 반복 설정 */}
                <RepeatSettings 
                  form={form}
                  setForm={setForm}
                  handleIntervalChange={handleIntervalChange}
                  handleRepeatCountChange={handleRepeatCountChange}
                />
                
                {/* 태그 선택 영역 */}
                <div className="mb-3">
                  <h3 className="font-medium mb-2">태그 선택</h3>
                  <div className="h-32 overflow-y-auto pr-1 border rounded-md p-3 bg-white">
                    {safeTagItems.map((item, idx) => {
                      const tagGroup = safeTags.find(t => t.tagType === item.tagType);
                      const tagColor = tagGroup ? tagGroup.color : { bg: "bg-gray-100", text: "text-gray-800" };
                      const isSelected = selectedTagType === item.tagType && form.tag === item.tagName;
                      
                      return (
                        <div key={`${item.tagType}-${item.tagName}-${idx}`} className="flex items-center mb-2 last:mb-0">
                          <div className={`w-16 ${tagColor.bg} ${tagColor.text} px-2 py-1 rounded-l-md text-xs font-medium truncate`}>
                            {item.tagType}
                          </div>
                          <div 
                            className={`flex-1 ${tagColor.bg} ${tagColor.text} px-2 py-1 text-xs cursor-pointer hover:bg-opacity-80 transition-colors ${
                              isSelected ? 'ring-2 ring-blue-400 bg-opacity-90' : ''
                            }`}
                            onClick={() => handleSelectTag(item.tagType, item.tagName)}
                          >
                            {item.tagName}
                          </div>
                          <button 
                            className="bg-red-100 text-red-500 hover:bg-red-200 rounded-r-md px-2 py-1 text-xs transition-colors"
                            onClick={() => handleDeleteTagItem(item.tagType, item.tagName)}
                            title="태그 삭제"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                    {safeTagItems.length === 0 && (
                      <div className="text-center text-gray-500 py-8 text-sm">
                        <div className="mb-2">📝</div>
                        <div>태그를 추가해주세요</div>
                        <div className="text-xs text-gray-400 mt-1">
                          아래에서 새 태그를 만들 수 있습니다
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 🔧 개선된 새 태그 추가 - 즉시 반영 */}
                <div className="mb-3">
                  <h3 className="font-medium mb-2">새 태그 추가</h3>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="태그 타입"
                      className="w-20 text-xs bg-white border rounded-l-md px-2 py-1 focus:outline-none focus:border-blue-400 transition-colors"
                      value={newTagType}
                      onChange={(e) => setNewTagType(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="항목 이름"
                      className="flex-1 text-xs bg-white border-y border-r-0 px-2 py-1 focus:outline-none focus:border-blue-400 transition-colors"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newTagType.trim() && newTagName.trim()) {
                          handleAddTag();
                        }
                      }}
                    />
                    <button 
                      className="bg-blue-500 hover:bg-blue-600 text-white w-8 h-6 rounded-r-md flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-50"
                      onClick={handleAddTag}
                      disabled={!newTagType.trim() || !newTagName.trim() || isSaving}
                      title="태그 추가"
                    >
                      {isSaving ? '...' : '+'}
                    </button>
                  </div>
                  {newTagType.trim() && newTagName.trim() && (
                    <div className="mt-2 text-xs text-gray-600">
                      미리보기: <span className="bg-gray-100 px-2 py-1 rounded">{newTagType}</span> - {newTagName}
                    </div>
                  )}
                </div>
              </div>

              {/* 🔧 개선된 일정 추가 버튼 */}
              <button
                className="w-full bg-green-500 hover:bg-green-600 text-white text-center py-3 rounded-lg text-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAdd}
                disabled={!form.title || !startSlot || !form.end || isLoading || isSaving}
              >
                {isLoading || isSaving ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {isSaving ? '저장 중...' : '로딩 중...'}
                  </div>
                ) : (
                  <>
                    일정 추가하기
                    {form.weekdays?.length > 0 && form.repeatCount && parseInt(form.repeatCount) > 1 && (
                      <div className="text-sm mt-1 opacity-90">
                        {form.weekdays.length}개 요일 × {form.repeatCount}회 = {form.weekdays.length * parseInt(form.repeatCount)}개 일정
                      </div>
                    )}
                  </>
                )}
              </button>

              {/* 서버 연동 상태 정보 */}
              {isServerBased && (
                <div className="mt-3 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                  <div className="flex items-center justify-between">
                    <span>🌐 서버 자동 저장 활성화</span>
                    {lastSyncTime && !isLoading && !isSaving && (
                      <span className="text-blue-500">
                        ✅ {lastSyncTime.toLocaleTimeString('ko-KR')}
                      </span>
                    )}
                    {(isLoading || isSaving) && (
                      <span className="text-orange-600">
                        {isSaving ? '💾 저장 중...' : '🔄 로딩 중...'}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-blue-600">
                    {isSaving ? '서버에 데이터를 저장하고 있습니다' :
                     isLoading ? '서버에서 최신 데이터를 가져오고 있습니다' :
                     '모든 변경사항이 실시간으로 서버에 저장됩니다'}
                  </div>
                </div>
              )}

              {/* ✅ 문제 2 해결: 사용법 안내 추가 */}
              <div className="mt-3 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-700">
                <div className="font-medium mb-1">💡 사용법 안내</div>
                <div className="space-y-1">
                  <div>• 드래그: 포커스된 날짜(가운데)에서 일정을 드래그하여 이동</div>
                  <div>• 복사: 우클릭 → 복사 → 원하는 위치에 클릭</div>
                  <div>• 크기조정: 포커스된 날짜에서 일정 상하단 드래그</div>
                  <div>• 요일반복: 월,수 선택 후 일정 추가하면 해당 요일에 생성</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyCalendarUI;
