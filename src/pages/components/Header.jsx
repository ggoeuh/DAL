import React from "react";

const TotalTimeDisplay = ({ schedules }) => {
  // 직접 시간 계산 로직 구현
  const calculateTotal = () => {
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return "00:00";
    }
    
    try {
      // 시간(문자열)을 분으로 변환
      const parseTimeToMinutes = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
        return (hours * 60) + minutes;
      };
      
      // 총 시간 계산
      let totalMinutes = 0;
      
      schedules.forEach(schedule => {
        if (!schedule.start || !schedule.end) return;
        
        const startMinutes = parseTimeToMinutes(schedule.start);
        const endMinutes = parseTimeToMinutes(schedule.end);
        
        if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) {
          return;
        }
        
        const duration = endMinutes - startMinutes;
        totalMinutes += duration;
      });
      
      // 시:분 형식으로 변환
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
      
    } catch (error) {
      console.error("Error calculating total time:", error);
      return "00:00";
    }
  };

  const totalTime = calculateTotal();

  // 별도의 컴포넌트로 분리된 총 시간 표시
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '0',
      right: '0',
      textAlign: 'center',
      zIndex: 1000
    }}>
      <div style={{
        display: 'inline-block',
        backgroundColor: '#16a34a',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '999px',
        fontWeight: 'bold',
        boxShadow: '0 3px 6px rgba(0,0,0,0.2)'
      }}>
        Total Time: {totalTime}
      </div>
    </div>
  );
};

export default TotalTimeDisplay;