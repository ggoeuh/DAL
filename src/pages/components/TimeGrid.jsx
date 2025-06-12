import React, { useState, useRef, useEffect } from "react";
import {
  parseTimeToMinutes,
  minutesToTimeString,
  pixelToNearestTimeSlot,
  calculateSlotPosition,
  getCurrentTimeLine
} from "../utils/time";
import { filterSchedulesByDate } from "../utils/schedule";
import { PASTEL_COLORS } from "../constants/colors";

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const TimeGrid = ({ schedules = [], setSchedules, tagItems = [] }) => {
  const SLOT_HEIGHT = 24;
  const today = new Date();

  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  });

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

  const [activeTimeSlot, setActiveTimeSlot] = useState(null);
  const [copyingSchedule, setCopyingSchedule] = useState(null);

  const handleDayFocus = (dayIndex) => {
    setFocusedDayIndex(dayIndex);
    const focusPosition = 3;
    const newVisibleDays = [];
    for (let i = 0; i < 5; i++) {
      const offset = i - focusPosition;
      const newIndex = (dayIndex + offset + 7) % 7;
      newVisibleDays.push(newIndex);
    }
    setVisibleDays(newVisibleDays);
  };

  const handleTimeSlotClick = (time) => {
    setActiveTimeSlot(time);
  };

  const handleDropSchedule = (dayIndex, yPos) => {
    if (!copyingSchedule) return;

    const date = currentWeek[dayIndex].toISOString().split("T")[0];
    const dropTimeSlot = pixelToNearestTimeSlot(yPos);

    const startMinutes = parseTimeToMinutes(copyingSchedule.start);
    const endMinutes = parseTimeToMinutes(copyingSchedule.end);
    const duration = endMinutes - startMinutes;

    const newStartMinutes = parseTimeToMinutes(dropTimeSlot);
    const newEnd = minutesToTimeString(newStartMinutes + duration);

    const newSchedule = {
      ...copyingSchedule,
      id: Date.now(),
      date,
      start: dropTimeSlot,
      end: newEnd
    };

    setSchedules([...schedules, newSchedule]);
    setCopyingSchedule(null);
  };

  const getTagColor = (tagType) => {
    return PASTEL_COLORS.find(c => c.name === tagType) || { bg: "bg-gray-100", text: "text-gray-800" };
  };

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    // context menu logic here (future)
  };

  const handleResizeStart = () => {
    // future logic
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex">
          {/* 시간 열 */}
          <div className="w-10 flex-shrink-0 relative" style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}>
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

          {/* 요일 헤더 */}
          <div className="flex border-b border-gray-200">
            <div className="w-10 flex-shrink-0" /> {/* 시간칸 여백 */}
            {visibleDays.map((dayIndex, i) => {
              const date = currentWeek[dayIndex];
              const isFocusDay = i === 3; // 가운데가 선택된 날

              return (
                <div
                  key={dayIndex}
                  className={`text-center py-2 border-l border-gray-200 cursor-pointer ${isFocusDay ? 'bg-blue-50 font-bold' : 'bg-white'}`}
                  style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                  onClick={() => handleDayFocus(dayIndex)}
                >
                  <div>{DAYS_OF_WEEK[date.getDay()]}</div>
                  <div className="text-sm">{formatDate(date)}</div>
                </div>
              );
            })}
          </div>

          {/* 날짜 열 */}
          <div className="flex flex-1 overflow-hidden">
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

            {/* 날짜별 열들 */}
            {visibleDays.map((dayIndex, i) => {
              const date = currentWeek[dayIndex];
              const isFocusDay = i === 3;
              const dateSchedules = filterSchedulesByDate(schedules, date);

              return (
                <div
                  key={dayIndex}
                  className="relative border-l border-gray-200 flex flex-col transition-all duration-300"
                  style={{ flexGrow: isFocusDay ? 2 : 1.5, minWidth: 0 }}
                  onMouseUp={(e) => {
                    if (copyingSchedule) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      handleDropSchedule(dayIndex, e.clientY - rect.top);
                    }
                  }}
                >
                  {/* ... 날짜 열 내부 (슬롯, 일정, 현재시간 등 기존 코드 그대로) */}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeGrid;
