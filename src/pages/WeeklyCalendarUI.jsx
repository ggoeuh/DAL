import React, { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

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
    safeSchedules,
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

  // ✨ 체크박스 변경 핸들러 - useCallback으로 메모이제이션하여 무한 루프 방지
  const handleCheckboxChange = useCallback((scheduleId, currentDone) => {
    if (isAdminView) return;
    
    if (calendarLogic.setSchedules && currentUser) {
      const updated = safeSchedules.map(item =>
        item.id === scheduleId ? { ...item, done: !currentDone } : item
      );
      // 상위 컴포넌트의 setSchedules 호출 (서버 저장 포함)
      calendarLogic.setSchedules(updated);
    }
  }, [isAdminView, calendarLogic.setSchedules, currentUser, safeSchedules]);

  // 이벤트 리스너 등록 - 의존성 배열 최적화
  useEffect(() => {
    const cleanup = [];

    if (resizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      cleanup.push(() => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      });
    }
    
    if (copyingSchedule) {
      window.addEventListener('mousemove', handleCopyMove);
      window.addEventListener('mouseup', handleCopyEnd);
      cleanup.push(() => {
        window.removeEventListener('mousemove', handleCopyMove);
        window.removeEventListener('mouseup', handleCopyEnd);
      });
    }
    
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      cleanup.push(() => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
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
    autoScrollTimer,
    handleResizeMove, 
    handleResizeEnd, 
    handleCopyMove, 
    handleCopyEnd, 
    handleDragMove, 
    handleDragEnd, 
    setContextMenu
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
              {`${formatDate(currentWeek[0])} - ${formatDate(currentWeek[6])}`}
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
          {Object.entries(tagTotals).map(([tagType, totalTime]) => {
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
                {visibleDays.map((dayIndex, i) => {
                  const date = currentWeek[dayIndex];
                  const isFocusDay = i === 3;
                  return (
                    <div
                      key={dayIndex}
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
                  {visibleDays.map((dayIndex, i) => {
                    const date = currentWeek[dayIndex];
                    const isFocusDay = i === 3;
                    const dateSchedules = filterSchedulesByDate(safeSchedules, date);

                    return (
                      <div
                        key={dayIndex}
                        data-day-index={dayIndex}
                        className="relative border-l border-gray-200 flex flex-col transition-all duration-300"
                        style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                      >
                        {/* 시간 슬롯 + 일정 */}
                        <div
                          className={`flex-1 relative ${isFocusDay ? 'bg-blue-50 bg-opacity-30' : ''}`}
                          style={{ height: `${SLOT_HEIGHT * 48}px` }}
                        >
                          {timeSlots.map((time, i) => (
                            <div
                              key={time}
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

                          {/* 일정들 */}
                          {dateSchedules.map((s) => {
                            const top = calculateSlotPosition(s.start);
                            const bottom = calculateSlotPosition(s.end);
                            const height = bottom - top;
                            const tagTypeForItem = safeTagItems.find(item => item.tagName === s.tag)?.tagType || s.tagType;
                            const tagColor = getTagColor(tagTypeForItem);
                            const isDragging = dragging === s.id;

                            return (
                              <div
                                key={s.id}
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
                    value={form.title}
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
                          onChange={(e) => setForm({ ...form, end: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  ></textarea>
                  
                  {/* 반복 옵션 영역 */}
                  <div className="mb-3">
                    <h3 className="font-medium mb-2">반복 설정</h3>
                    
                    <div className="flex gap-2 mb-2">
                      {/* 반복 횟수 */}
                      <select
                        className="flex-1 border rounded-md p-2 text-xs"
                        value={form.repeatCount}
                        onChange={(e) => setForm({ ...form, repeatCount: e.target.value })}
                      >
                        <option value="1">반복 없음</option>
                        {repeatOptions.map((count) => (
                          <option key={count} value={count}>
                            {count}번 반복
                          </option>
                        ))}
                      </select>

                      {/* 주기 설정 */}
                      <select
                        className="flex-1 border rounded-md p-2 text-xs"
                        value={form.interval}
                        onChange={(e) => setForm({ ...form, interval: e.target.value })}
                      >
                        {intervalOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 요일 선택 */}
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day, idx) => {
                        const selected = form.weekdays.includes(day);
                        return (
                          <button
                            key={idx}
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
                      {safeTagItems.map((item, idx) => {
                        const tagGroup = safeTags.find(t => t.tagType === item.tagType);
                        const tagColor = tagGroup ? tagGroup.color : { bg: "bg-gray-100", text: "text-gray-800" };
                        
                        return (
                          <div key={idx} className="flex items-center mb-2 last:mb-0">
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
                      {safeTagItems.length === 0 && (
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
                      value={newTagType}
                      onChange={(e) => setNewTagType(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="항목 이름"
                      className="flex-1 text-xs bg-white border-y border-r-0 px-2 py-1 focus:outline-none focus:border-gray-400"
                      value={newTagName}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
