// schedule.js - 일정 관련 유틸리티
import { parseTimeToMinutes } from "./time";

export const filterSchedulesByDate = (schedules, date) => {
  const dateString = date.toISOString().split("T")[0];
  return schedules.filter(schedule => schedule.date === dateString);
};

export const checkScheduleOverlap = (schedules, newSchedule) => {
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

// 태그별 총 시간 계산 및 전체 합 반환
export const calculateTagTotals = (schedules) => {
  const totals = {};
  let totalMinutes = 0;
  
  schedules.forEach(schedule => {
    const tagType = schedule.tagType || "기타";
    if (!totals[tagType]) {
      totals[tagType] = 0;
    }
    
    const startMinutes = parseTimeToMinutes(schedule.start);
    const endMinutes = parseTimeToMinutes(schedule.end);
    const duration = endMinutes - startMinutes;
    
    totals[tagType] += duration;
    totalMinutes += duration;
  });
  
  // 시:분 형식으로 변환
  const convert = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };
  
  // 태그별 시간을 시:분 형식으로 변환
  Object.keys(totals).forEach(key => {
    totals[key] = convert(totals[key]);
  });
  
  // 전체 시간도 추가
  totals.__total = convert(totalMinutes);
  
  return totals;
};