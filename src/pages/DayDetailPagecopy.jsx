// 1단계: 가장 간단한 WeeklyCalendar로 디버깅
import React from "react";
import { useSearchParams } from "react-router-dom";

const DebugWeeklyCalendar = ({ currentUser, onLogout }) => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  
  console.log('🔍 WeeklyCalendar 렌더링 시작');
  console.log('📅 URL date 파라미터:', dateParam);
  console.log('👤 currentUser:', currentUser);
  
  // 기본 테스트
  React.useEffect(() => {
    console.log('✅ WeeklyCalendar useEffect 실행됨');
    console.log('📍 현재 위치:', window.location.href);
  }, []);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">주간 캘린더 (디버그 모드)</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">디버그 정보</h2>
          <div className="space-y-2 text-sm font-mono">
            <div>📅 URL date 파라미터: <span className="bg-yellow-100 px-2 py-1 rounded">{dateParam || '없음'}</span></div>
            <div>👤 currentUser: <span className="bg-blue-100 px-2 py-1 rounded">{currentUser || '없음'}</span></div>
            <div>📍 현재 URL: <span className="bg-green-100 px-2 py-1 rounded">{window.location.href}</span></div>
            <div>⏰ 렌더링 시간: <span className="bg-purple-100 px-2 py-1 rounded">{new Date().toLocaleTimeString()}</span></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">네비게이션 테스트</h2>
          <div className="flex gap-4">
            <button 
              onClick={() => window.history.back()}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              ← 뒤로가기
            </button>
            <button 
              onClick={onLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              로그아웃
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">상태 확인</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-medium mb-2">React 상태</h3>
              <div className="text-sm space-y-1">
                <div>✅ 컴포넌트 마운트됨</div>
                <div>✅ useSearchParams 작동함</div>
                <div>✅ React 렌더링 정상</div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-medium mb-2">브라우저 상태</h3>
              <div className="text-sm space-y-1">
                <div>📱 User Agent: {navigator.userAgent.split(' ')[0]}</div>
                <div>🌐 온라인 상태: {navigator.onLine ? '온라인' : '오프라인'}</div>
                <div>⚡ 로딩 상태: 완료</div>
              </div>
            </div>
          </div>
        </div>

        {dateParam && (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg mt-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">선택된 날짜 정보</h2>
            <div className="space-y-2">
              <div>📅 원본 날짜: {dateParam}</div>
              <div>📆 파싱된 날짜: {new Date(dateParam).toLocaleDateString('ko-KR')}</div>
              <div>📝 요일: {new Date(dateParam).toLocaleDateString('ko-KR', { weekday: 'long' })}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugWeeklyCalendar;
