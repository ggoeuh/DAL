// pages/AdminDashboard.jsx - 관리자 대시보드 페이지 (localStorage 기반)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = ({ currentUser, onLogout, getAllUsers, getUserStats, getUserData }) => {
  const [members, setMembers] = useState([]);
  const [memberStats, setMemberStats] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 파스텔 색상 팔레트 (CalendarPage와 동일)
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

  // 태그 색상 가져오기 (CalendarPage와 동일)
  const getTagColor = (tagType, tags) => {
    const tag = tags.find(t => t.tagType === tagType);
    return tag ? tag.color : PASTEL_COLORS[0];
  };

  // CalendarPage와 정확히 동일한 태그별 목표 달성률 계산 함수
  const calculateTagProgress = (member) => {
    const userData = getUserData(member);
    if (!userData) return [];

    const { schedules = [], tags = [], tagItems = [], monthlyGoals = [] } = userData;
    const currentDate = new Date();
    const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM 형식
    
    // 시간을 분으로 변환하는 함수
    const parseTimeToMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    // 분을 시간 형식으로 변환하는 함수
    const minutesToTimeString = (totalMinutes) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    };

    // 퍼센테이지 계산
    const calculatePercentage = (actual, goal) => {
      if (goal === 0) return 0;
      return Math.round((actual / goal) * 100);
    };

    // 현재 월의 일정들만 필터링
    const currentMonthSchedules = schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleMonth = scheduleDate.toISOString().slice(0, 7);
      return scheduleMonth === currentMonth;
    });

    // 태그별 총 시간 계산 (실제 사용 시간) - CalendarPage와 정확히 동일
    const monthlyTagTotals = {};
    
    currentMonthSchedules.forEach(schedule => {
      // 태그 항목에서 tagType 찾기
      const tagItem = tagItems.find(item => item.tagName === schedule.tag);
      const tagType = tagItem ? tagItem.tagType : (schedule.tagType || "기타");
      
      if (!monthlyTagTotals[tagType]) {
        monthlyTagTotals[tagType] = 0;
      }
      
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const duration = endMinutes - startMinutes;
      
      monthlyTagTotals[tagType] += duration;
    });

    // 월간 목표 불러오기 - CalendarPage와 정확히 동일한 방식
    const loadMonthlyGoals = () => {
      try {
        const currentMonthKey = currentMonth;
        const allGoals = monthlyGoals;
        const found = allGoals.find(goal => goal.month === currentMonthKey);
        return found?.goals || [];
      } catch (error) {
        console.error('월간 목표 불러오기 실패:', error);
        return [];
      }
    };

    const currentMonthGoalsData = loadMonthlyGoals();
    
    // 목표가 있거나 이번 달에 실제 사용된 태그타입만 표시
    const goalTagTypes = currentMonthGoalsData.map(goal => goal.tagType);
    const currentMonthUsedTagTypes = [...new Set(currentMonthSchedules.map(schedule => {
      const tagItem = tagItems.find(item => item.tagName === schedule.tag);
      return tagItem ? tagItem.tagType : (schedule.tagType || "기타");
    }))];
    
    const allTagTypes = [...new Set([...goalTagTypes, ...currentMonthUsedTagTypes])];

    // CalendarPage와 정확히 동일한 로직으로 결과 생성
    return allTagTypes.map((tagType) => {
      // 태그 색상 가져오기 (CalendarPage와 동일)
      const tagColor = getTagColor(tagType, tags);
      
      const actualMinutes = monthlyTagTotals[tagType] || 0;
      const actualTime = minutesToTimeString(actualMinutes);
      
      // 목표 시간 찾기
      const goal = currentMonthGoalsData.find(g => g.tagType === tagType);
      const goalMinutes = goal ? parseTimeToMinutes(goal.targetHours) : 0;
      const goalTime = goal ? goal.targetHours : "00:00";
      
      // 퍼센테이지 계산
      const percentage = calculatePercentage(actualMinutes, goalMinutes);
      
      return {
        tagName: tagType,
        tagColor: tagColor, // 이제 색상 객체
        targetTime: goalTime,
        actualTime: actualTime,
        percentage: percentage
      };
    }).filter(progress => {
      // 목표가 설정되었거나 실제 시간이 있는 것만 표시
      return progress.targetTime !== "00:00" || progress.actualTime !== "00:00";
    });
  };

  useEffect(() => {
    const loadMemberData = () => {
      try {
        // props로 전달받은 함수들을 사용하여 멤버 데이터 로드
        const foundMembers = getAllUsers();
        console.log('발견된 멤버들:', foundMembers);
        setMembers(foundMembers);

        // 각 멤버의 통계 데이터 계산
        const stats = getUserStats();
        setMemberStats(stats);
        setLoading(false);
      } catch (error) {
        console.error('멤버 데이터 로딩 실패:', error);
        setLoading(false);
      }
    };

    loadMemberData();
  }, [getAllUsers, getUserStats]);

  const handleMemberAction = (memberName, actionType) => {
    console.log('🔍 멤버 액션 시작:', { memberName, actionType });
    
    // 데이터 검증
    const userData = getUserData(memberName);
    console.log('🔍 이동 전 데이터 검증:', {
      memberName,
      userData: !!userData,
      userDataKeys: userData ? Object.keys(userData) : null,
      schedules: userData?.schedules?.length || 0
    });
    
    switch (actionType) {
      case 'detailed-calendar':
        const targetUrl = `/admin/member/${memberName}`;
        console.log('🔍 네비게이션 시도:', targetUrl);
        navigate(targetUrl);
        break;
      default:
        console.log('❌ 지원하지 않는 액션:', actionType);
    }
  };
  
  // 멤버 카드에서 버튼들을 하나로 단순화
  <div className="space-y-2">
    <button
      onClick={() => handleMemberAction(member, 'detailed-calendar')}
      className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-4 rounded-lg transition duration-200 text-sm font-medium flex items-center justify-center"
    >
      <span className="mr-2">📅</span>
      상세 캘린더 보기
    </button>
    
    <button
      onClick={() => {
        const tagProgress = calculateTagProgress(member);
        if (tagProgress.length === 0) {
          alert(`📊 ${member}님 상세 정보\n\n• 설정된 월간 목표가 없습니다\n• 목표를 설정하면 달성률을 확인할 수 있습니다`);
        } else {
          const avgProgress = Math.round(tagProgress.reduce((sum, p) => sum + p.percentage, 0) / tagProgress.length);
          const progressDetails = tagProgress.map(p => 
            `• ${p.tagName}: ${p.actualTime}/${p.targetTime} (${p.percentage}%)`
          ).join('\n');
          
          alert(`📊 ${member}님 목표 달성 현황\n\n${progressDetails}\n\n평균 달성률: ${avgProgress}%\n조회 시간: ${new Date().toLocaleString('ko-KR')}`);
        }
      }}
      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition duration-200 text-sm font-medium flex items-center justify-center"
    >
      <span className="mr-2">📈</span>
      상세 달성률 보기
    </button>
  </div>

  // 관리자용 데이터 관리 함수들
  const handleDataDebug = () => {
    const result = window.confirm('⚠️ 모든 localStorage 데이터를 콘솔에 출력하시겠습니까?');
    if (result) {
      console.log('=== localStorage 전체 데이터 ===');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        try {
          console.log(`${key}:`, JSON.parse(value));
        } catch (e) {
          console.log(`${key}:`, value);
        }
      }
      alert('✅ 콘솔에 데이터가 출력되었습니다. 개발자 도구를 확인하세요.');
    }
  };

  const handleUserDataReset = (memberName) => {
    const result = window.confirm(`⚠️ ${memberName}님의 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
    if (result) {
      // 사용자별 데이터 삭제
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${memberName}-`)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        localStorage.removeItem(key);
        console.log(`삭제됨: ${key}`);
      });
      
      alert(`✅ ${memberName}님의 데이터가 삭제되었습니다. (${keysToDelete.length}개 항목)`);
      
      // 데이터 새로고침
      const foundMembers = getAllUsers();
      setMembers(foundMembers);
      const stats = getUserStats();
      setMemberStats(stats);
    }
  };

  const handleCalendarDataReset = () => {
    const result = window.confirm('⚠️ 모든 사용자의 캘린더 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
    if (result) {
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('schedules') ||
          key.includes('tags') ||
          key.includes('tagItems') ||
          key.includes('monthlyPlans') ||
          key.includes('monthlyGoals')
        )) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        localStorage.removeItem(key);
      });
      
      alert(`✅ 모든 캘린더 데이터가 삭제되었습니다. (${keysToDelete.length}개 항목)`);
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">멤버 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 관리자 네비게이션 */}
      <nav className="bg-red-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">👑 관리자 대시보드</h1>
            <span className="text-red-200 text-sm">({currentUser})</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-red-200 text-sm">
              {new Date().toLocaleDateString('ko-KR')}
            </span>
            <button 
              onClick={onLogout}
              className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded transition duration-200"
            >
              로그아웃
            </button>
          </div>
        </div>
      </nav>
      
      {/* 메인 컨텐츠 */}
      <div className="container mx-auto p-8">
        {/* 헤더 섹션 */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">멤버 관리</h2>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>총 {members.length}명의 멤버</span>
            <span>•</span>
            <span>마지막 업데이트: {new Date().toLocaleString('ko-KR')}</span>
          </div>
        </div>

        {/* 멤버 카드 그리드 */}
        {members.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 text-8xl mb-6">👥</div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-3">등록된 멤버가 없습니다</h3>
            <p className="text-gray-500 mb-6">
              멤버가 로그인하여 데이터를 생성하면 여기에 표시됩니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <h4 className="font-semibold mb-2">💡 도움말</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 멤버가 로그인하면 자동으로 감지됩니다</li>
                <li>• localStorage에 저장된 데이터를 실시간으로 조회합니다</li>
                <li>• 각 멤버의 데이터는 독립적으로 관리됩니다</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => {
              const stats = memberStats[member] || {};
              return (
                <div key={member} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
                  {/* 멤버 헤더 */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-xl">
                          {member.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-xl font-semibold text-gray-800">{member}</h3>
                        <p className="text-gray-500 text-sm flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                          활성 멤버
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 멤버 통계 - 태그별 목표 달성률 */}
                  <div className="p-6">
                    <h4 className="font-semibold text-gray-700 mb-3">🎯 이번 달 목표 달성률</h4>
                    {(() => {
                      const tagProgress = calculateTagProgress(member);
                      
                      if (tagProgress.length === 0) {
                        return (
                          <div className="text-center py-4">
                            <div className="text-gray-400 text-3xl mb-2">📊</div>
                            <p className="text-gray-500 text-sm">설정된 목표가 없습니다</p>
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-3">
                          {tagProgress.map((progress, index) => (
                            <div key={index} className={`${progress.tagColor.bg} ${progress.tagColor.border} rounded-lg p-4 border-2`}>
                              {/* 태그명과 퍼센테이지를 같은 행 상단에 배치 */}
                              <div className="flex items-center justify-between mb-3">
                                <span className={`text-sm font-semibold ${progress.tagColor.text}`}>
                                  {progress.tagName}
                                </span>
                                <span className={`text-lg font-bold ${
                                  progress.percentage >= 100 ? 'text-green-600' :
                                  progress.percentage >= 70 ? 'text-blue-600' :
                                  progress.percentage >= 30 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {progress.percentage}%
                                </span>
                              </div>
                              
                              {/* 시간 정보 */}
                              <div className="space-y-1 mb-3">
                                <div className="flex justify-between text-sm text-gray-600">
                                  <span>실제:</span>
                                  <span className={`font-semibold ${progress.tagColor.text}`}>{progress.actualTime}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                  <span>목표:</span>
                                  <span className={`font-semibold ${progress.tagColor.text}`}>{progress.targetTime}</span>
                                </div>
                              </div>
                              
                              {/* 진행률 바 */}
                              <div className="w-full bg-white rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    progress.percentage >= 100 ? 'bg-green-500' :
                                    progress.percentage >= 75 ? 'bg-blue-500' :
                                    progress.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                          
                          {/* 전체 평균 달성률 */}
                          <div className="pt-2 border-t border-gray-200">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600 flex items-center">
                                <span className="mr-2">📈</span>
                                평균 달성률
                              </span>
                              <span className="font-bold text-gray-800">
                                {tagProgress.length > 0 
                                  ? Math.round(tagProgress.reduce((sum, p) => sum + p.percentage, 0) / tagProgress.length)
                                  : 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* 액션 버튼들 */}
                  <div className="p-6 pt-0">
                    <h4 className="font-semibold text-gray-700 mb-3">🔍 데이터 조회</h4>
                    <div className="space-y-2">
                    <button
                      onClick={() => {
                        console.log('🔍 캘린더 보기 버튼 클릭:', member);
                        // 데이터 미리 검증
                        const userData = getUserData(member);
                        if (!userData) {
                          alert(`❌ ${member}님의 데이터를 찾을 수 없습니다.\n먼저 해당 멤버가 로그인하여 데이터를 생성해야 합니다.`);
                          return;
                        }
                        
                        console.log('🔍 데이터 확인됨, 페이지 이동:', {
                          member,
                          schedules: userData.schedules?.length || 0,
                          tags: userData.tags?.length || 0
                        });
                        
                        handleMemberAction(member, 'detailed-calendar');
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-lg transition duration-200 text-sm font-medium flex items-center justify-center"
                    >
                      <span className="mr-2">📅</span>
                      캘린더 보기
                    </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 관리자 도구 */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🔧</span>
            관리자 도구
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => {
                const memberCount = members.length;
                const totalData = Object.values(memberStats).reduce((sum, stats) => 
                  sum + stats.schedules + stats.tags + stats.tagItems + stats.monthlyPlans + stats.monthlyGoals, 0
                );
                alert(`📊 시스템 현황\n\n• 등록된 멤버: ${memberCount}명\n• 총 데이터: ${totalData}개\n• 상태: 정상 운영중`);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium"
            >
              📊 시스템 현황
            </button>
            
            <button
              onClick={handleDataDebug}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium"
            >
              🔍 데이터 디버그
            </button>
            
            <button
              onClick={handleCalendarDataReset}
              className="bg-orange-100 hover:bg-orange-200 text-orange-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium"
            >
              🗑️ 전체 캘린더 데이터 삭제
            </button>
            
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="bg-green-100 hover:bg-green-200 text-green-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium"
            >
              🔄 새로고침
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;