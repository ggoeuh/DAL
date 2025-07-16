// AdminMemberView.jsx - 하위 태그별 세부 활동 진행률 표시 버전
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';
import DetailedCalendar from './DetailedCalendar';

const AdminMemberView = ({ currentUser, onLogout }) => {
  const { memberName } = useParams();
  const navigate = useNavigate();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  console.log('🔍 AdminMemberView 렌더링 (서버 기반):', {
    currentUser, 
    memberName
  });

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

  // ✅ 서버 태그 색상을 우선 사용하고, 없으면 기본 색상 생성하는 함수
  const getTagColor = useCallback((tagOrSubTag) => {
    if (!memberData || !tagOrSubTag) {
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
    }

    // 1. 직접 서버 태그 색상 확인
    const directServerTag = memberData.tags?.find(t => 
      t.tagType === tagOrSubTag || t.tag === tagOrSubTag
    );
    if (directServerTag && directServerTag.color) {
      return directServerTag.color;
    }
    
    // 2. 하위 태그인 경우, tagItems에서 상위 태그 찾아서 색상 가져오기
    const tagItem = memberData.tagItems?.find(item => 
      item.tagName === tagOrSubTag || item.tag === tagOrSubTag
    );
    
    if (tagItem && tagItem.tagType) {
      const parentTagColor = memberData.tags?.find(t => t.tagType === tagItem.tagType);
      if (parentTagColor && parentTagColor.color) {
        return parentTagColor.color;
      }
    }
    
    // 3. 현재 월 목표에서 해당 하위 태그의 상위 태그 찾기
    const currentMonth = format(currentDate, 'yyyy-MM');
    const currentGoal = memberData.monthlyGoals?.find(mg => mg.month === currentMonth);
    
    if (currentGoal?.goals) {
      const goalWithTag = currentGoal.goals.find(goal => goal.tag === tagOrSubTag);
      if (goalWithTag && goalWithTag.tagType) {
        const parentTagColor = memberData.tags?.find(t => t.tagType === goalWithTag.tagType);
        if (parentTagColor && parentTagColor.color) {
          return parentTagColor.color;
        }
      }
    }
    
    // 4. 일정에서 해당 하위 태그의 상위 태그 찾기
    const scheduleWithTag = memberData.schedules?.find(schedule => schedule.tag === tagOrSubTag);
    if (scheduleWithTag && scheduleWithTag.tagType) {
      const parentTagColor = memberData.tags?.find(t => t.tagType === scheduleWithTag.tagType);
      if (parentTagColor && parentTagColor.color) {
        return parentTagColor.color;
      }
    }
    
    // 5. 기본 색상 할당 (해시 기반)
    const index = Math.abs(tagOrSubTag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
  }, [memberData, currentDate]);

  // 시간 변환 함수들
  const parseTimeToMinutes = useCallback((time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }, []);

  const minutesToTimeString = useCallback((totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }, []);

  // ✅ 현재 월의 일정들만 필터링
  const currentMonthSchedules = useMemo(() => {
    if (!memberData?.schedules) return [];
    
    const currentMonth = format(currentDate, 'yyyy-MM');
    const filtered = memberData.schedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      const scheduleMonth = format(scheduleDate, 'yyyy-MM');
      return scheduleMonth === currentMonth;
    });
    
    return filtered;
  }, [memberData?.schedules, currentDate]);

  // ✅ 현재 월의 월간 목표 가져오기
  const currentMonthGoals = useMemo(() => {
    if (!memberData?.monthlyGoals) return [];
    
    const currentMonth = format(currentDate, 'yyyy-MM');
    const currentGoal = memberData.monthlyGoals.find(mg => mg.month === currentMonth);
    const goals = currentGoal?.goals || [];
    
    return goals;
  }, [memberData?.monthlyGoals, currentDate]);

  // ✅ 상위 태그별 실제 시간 계산
  const tagTypeTotals = useMemo(() => {
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
  }, [currentMonthSchedules, parseTimeToMinutes]);

  // ✅ 하위 태그별 총 시간 계산
  const monthlyTagTotals = useMemo(() => {
    const totals = {};
    
    currentMonthSchedules.forEach(schedule => {
      const subTag = schedule.tag || "기타";
      
      if (!totals[subTag]) {
        totals[subTag] = 0;
      }
      
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const duration = endMinutes - startMinutes;
      
      totals[subTag] += duration;
    });
    
    return totals;
  }, [currentMonthSchedules, parseTimeToMinutes]);

  // ✅ 하위 태그들
  const allSubTags = useMemo(() => {
    const goalSubTags = currentMonthGoals.map(goal => goal.tag);
    const currentMonthUsedSubTags = [...new Set(currentMonthSchedules.map(schedule => schedule.tag || "기타"))];
    const result = [...new Set([...goalSubTags, ...currentMonthUsedSubTags])];
    
    return result;
  }, [currentMonthGoals, currentMonthSchedules]);

  // ✅ 상위 태그들 추출
  const allTagTypes = useMemo(() => {
    const tagTypesFromGoals = currentMonthGoals.map(goal => goal.tagType || "기타");
    const tagTypesFromSchedules = [...new Set(currentMonthSchedules.map(schedule => schedule.tagType || "기타"))];
    const result = [...new Set([...tagTypesFromGoals, ...tagTypesFromSchedules])];
    
    return result;
  }, [currentMonthGoals, currentMonthSchedules]);

  // 퍼센테이지 계산 함수
  const calculatePercentage = useCallback((actual, goal) => {
    if (goal === 0) return 100;
    return Math.round((actual / goal) * 100);
  }, []);

  // ✅ 특정 하위 태그의 목표 시간 찾기
  const getGoalHoursForSubTag = useCallback((subTag) => {
    const goal = currentMonthGoals.find(g => g.tag === subTag);
    
    if (goal && goal.targetHours) {
      const [hours] = goal.targetHours.split(':').map(Number);
      return hours * 60; // 분으로 변환
    }
    return 0;
  }, [currentMonthGoals]);

  // ✨ 완전 서버 기반 데이터 로딩
  useEffect(() => {
    console.log('🔍 AdminMemberView useEffect 실행 (서버 기반):', { memberName });
    
    if (!memberName) {
      setError('멤버 이름이 제공되지 않았습니다');
      setLoading(false);
      return;
    }

    const loadMemberDataFromServer = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🌐 서버에서 데이터 로딩 시작:', memberName);
        
        if (!supabase) {
          throw new Error('Supabase 클라이언트가 초기화되지 않았습니다');
        }

        // 서버에서 데이터 로드
        const result = await loadUserDataFromDAL(memberName);
        
        if (!result.success) {
          throw new Error(result.error || '서버 데이터 로드 실패');
        }

        const serverData = result.data;
        
        console.log('✅ 서버 데이터 로드 성공:', {
          memberName,
          schedules: serverData?.schedules?.length || 0,
          tags: serverData?.tags?.length || 0,
          tagItems: serverData?.tagItems?.length || 0,
          monthlyPlans: serverData?.monthlyPlans?.length || 0,
          monthlyGoals: serverData?.monthlyGoals?.length || 0
        });

        // 데이터 구조 검증 및 기본값 설정
        const validatedData = {
          schedules: Array.isArray(serverData?.schedules) ? serverData.schedules : [],
          tags: Array.isArray(serverData?.tags) ? serverData.tags : [],
          tagItems: Array.isArray(serverData?.tagItems) ? serverData.tagItems : [],
          monthlyPlans: Array.isArray(serverData?.monthlyPlans) ? serverData.monthlyPlans : [],
          monthlyGoals: Array.isArray(serverData?.monthlyGoals) ? serverData.monthlyGoals : []
        };
        
        console.log('✅ 서버 데이터 검증 완료:', {
          memberName,
          validatedData: Object.keys(validatedData).reduce((acc, key) => {
            acc[key] = validatedData[key].length;
            return acc;
          }, {}),
          monthlyGoalsDetails: validatedData.monthlyGoals.map(mg => ({
            month: mg.month,
            goalsCount: mg.goals?.length || 0
          }))
        });
        
        setMemberData(validatedData);
        setLastSyncTime(new Date());
        
      } catch (error) {
        console.error('❌ 서버 데이터 로딩 실패:', error);
        setError(error.message || '서버에서 데이터를 불러올 수 없습니다');
        setMemberData(null);
      } finally {
        setLoading(false);
      }
    };

    loadMemberDataFromServer();
  }, [memberName]);

  // 수동 새로고침 함수
  const handleRefresh = async () => {
    console.log('🔄 수동 새로고침 시작:', memberName);
    setLoading(true);
    setError(null);
    
    try {
      const result = await loadUserDataFromDAL(memberName);
      
      if (result.success && result.data) {
        const validatedData = {
          schedules: Array.isArray(result.data?.schedules) ? result.data.schedules : [],
          tags: Array.isArray(result.data?.tags) ? result.data.tags : [],
          tagItems: Array.isArray(result.data?.tagItems) ? result.data.tagItems : [],
          monthlyPlans: Array.isArray(result.data?.monthlyPlans) ? result.data.monthlyPlans : [],
          monthlyGoals: Array.isArray(result.data?.monthlyGoals) ? result.data.monthlyGoals : []
        };
        
        setMemberData(validatedData);
        setLastSyncTime(new Date());
        console.log('✅ 수동 새로고침 완료');
      } else {
        throw new Error(result.error || '새로고침 실패');
      }
    } catch (error) {
      console.error('❌ 수동 새로고침 실패:', error);
      setError(error.message || '새로고침 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">서버에서 {memberName}님의 데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">Supabase 서버 연결 중...</p>
        </div>
      </div>
    );
  }

  if (error || !memberData) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* 관리자 네비게이션 바 */}
        <nav className="bg-red-600 text-white p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleBackToDashboard}
                className="hover:bg-red-700 px-3 py-1.5 rounded transition duration-200 flex items-center"
              >
                <span className="mr-2">←</span>
                대시보드로
              </button>
              <div className="border-l border-red-400 pl-4">
                <h1 className="text-xl font-bold">
                  👑 {memberName}님의 상세 캘린더
                </h1>
                <p className="text-red-200 text-sm">관리자: {currentUser} | 서버 기반</p>
              </div>
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

        {/* 서버 데이터 로딩 실패 메시지 */}
        <div className="p-8">
          <div className="bg-white rounded-lg shadow p-6 text-center max-w-md mx-auto">
            <div className="text-red-400 text-6xl mb-4">🌐</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">서버 데이터 로딩 실패</h3>
            <p className="text-gray-500 mb-4">
              {memberName}님의 데이터를 Supabase 서버에서 불러올 수 없습니다.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-700 text-sm">오류: {error}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-4">
              <h4 className="font-semibold mb-2">💡 해결 방법</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 해당 멤버가 로그인하여 서버에 데이터를 저장했는지 확인</li>
                <li>• Supabase 서버 연결 상태 확인</li>
                <li>• 네트워크 연결 상태 확인</li>
                <li>• 브라우저를 새로고침하고 다시 시도</li>
                <li>• 대시보드에서 다시 접근</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? '로딩 중...' : '서버 새로고침'}
              </button>
              <button
                onClick={handleBackToDashboard}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                대시보드로
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ AdminMemberView: DetailedCalendar 렌더링 준비 완료 (서버 기반)');

  // DetailedCalendar에 전달할 props 준비
  const detailedCalendarProps = {
    schedules: memberData.schedules || [],
    tags: memberData.tags || [],
    tagItems: memberData.tagItems || [],
    monthlyGoals: memberData.monthlyGoals || [],
    monthlyPlans: memberData.monthlyPlans || [],
    currentUser: memberName, // 조회 대상 멤버 이름
    isAdminView: true, // 관리자 뷰 모드
    isServerBased: true, // 서버 기반 모드
    onLogout: onLogout,
    onBackToDashboard: handleBackToDashboard,
    onRefresh: handleRefresh,
    lastSyncTime: lastSyncTime
  };

  console.log('🔍 DetailedCalendar props (서버 기반):', {
    memberName,
    schedulesCount: detailedCalendarProps.schedules.length,
    tagsCount: detailedCalendarProps.tags.length,
    tagItemsCount: detailedCalendarProps.tagItems.length,
    monthlyGoalsCount: detailedCalendarProps.monthlyGoals.length,
    monthlyGoalsData: detailedCalendarProps.monthlyGoals,
    isAdminView: detailedCalendarProps.isAdminView,
    isServerBased: detailedCalendarProps.isServerBased,
    lastSyncTime: detailedCalendarProps.lastSyncTime
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 서버 기반 상태 헤더 */}
      <div className="bg-blue-50 border-b border-blue-200 p-2">
        <div className="container mx-auto flex justify-between items-center text-sm">
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-blue-700">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              서버 기반 모드
            </span>
            <span className="text-blue-600">
              멤버: {memberName}
            </span>
            {lastSyncTime && (
              <span className="text-blue-500">
                마지막 동기화: {lastSyncTime.toLocaleTimeString('ko-KR')}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '🔄 로딩...' : '🔄 새로고침'}
            </button>
            <span className="text-blue-500 text-xs">
              데이터 소스: Supabase
            </span>
          </div>
        </div>
      </div>

      {/* ✅ CalendarPage 스타일의 월별 활동 요약 추가 */}
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">{memberName}님의 {format(currentDate, 'yyyy년 M월')} 활동 요약</h2>
          
          {/* 상위 태그 요약 (작은 카드들) */}
          {allTagTypes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-medium mb-3 text-gray-600">카테고리별 총 시간</h3>
              <div className="flex flex-wrap gap-3">
                {allTagTypes.map((tagType) => {
                  const tagColor = getTagColor(tagType);
                  const actualMinutes = tagTypeTotals[tagType] || 0;
                  const actualHours = Math.floor(actualMinutes / 60);
                  
                  return (
                    <div
                      key={tagType}
                      className={`px-4 py-2 rounded-lg border ${tagColor.bg} ${tagColor.border} shadow-sm`}
                    >
                      <div className={`text-sm font-medium ${tagColor.text}`}>
                        {tagType}: {actualHours}시간
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 하위 태그 상세 */}
          {allSubTags.length > 0 ? (
            <div>
              <h3 className="text-md font-medium mb-3 text-gray-600">세부 활동별 진행률</h3>
              
              {/* 목표가 있는 태그들 (큰 카드들) */}
              {allSubTags.filter(subTag => getGoalHoursForSubTag(subTag) > 0).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                  {allSubTags
                    .filter(subTag => getGoalHoursForSubTag(subTag) > 0)
                    .map((subTag) => {
                      const tagColor = getTagColor(subTag);
                      const actualMinutes = monthlyTagTotals[subTag] || 0;
                      const actualTime = minutesToTimeString(actualMinutes);
                      
                      const goalMinutes = getGoalHoursForSubTag(subTag);
                      const goalTime = minutesToTimeString(goalMinutes);
                      
                      const percentage = calculatePercentage(actualMinutes, goalMinutes);
                      
                      const getProgressColor = (percent) => {
                        if (percent >= 100) return "text-green-600";
                        if (percent >= 75) return "text-blue-600";
                        if (percent >= 50) return "text-yellow-600";
                        return "text-red-600";
                      };
                      
                      return (
                        <div
                          key={subTag}
                          className={`p-4 rounded-lg border-2 ${tagColor.bg} ${tagColor.border} shadow-sm hover:shadow-md transition-shadow`}
                        >
                          {/* 첫 번째 줄: 태그명과 진행률 */}
                          <div className="flex justify-between items-center mb-3">
                            <span className={`font-medium ${tagColor.text}`}>{subTag}</span>
                            <span className={`font-bold text-lg ${getProgressColor(percentage)}`}>
                              {percentage}%
                            </span>
                          </div>
                          
                          {/* 두 번째 줄: 실제시간/목표시간 */}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 text-sm">시간:</span>
                            <span className={`font-semibold text-sm ${tagColor.text}`}>
                              {actualTime} / {goalTime}
                            </span>
                          </div>
                          
                          {/* 진행률 바 */}
                          <div className="w-full bg-white rounded-full h-2 mt-3">
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
                      );
                    })}
                </div>
              )}
              
              {/* 목표가 없는 태그들 (작은 카드들) */}
              {allSubTags.filter(subTag => getGoalHoursForSubTag(subTag) === 0).length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {allSubTags
                    .filter(subTag => getGoalHoursForSubTag(subTag) === 0)
                    .map((subTag) => {
                      const tagColor = getTagColor(subTag);
                      const actualMinutes = monthlyTagTotals[subTag] || 0;
                      const actualHours = Math.floor(actualMinutes / 60);
                      
                      return (
                        <div
                          key={subTag}
                          className={`px-4 py-2 rounded-lg border ${tagColor.bg} ${tagColor.border} shadow-sm`}
                        >
                          <div className={`text-sm font-medium ${tagColor.text}`}>
                            {subTag}: {actualHours}시간
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">아직 등록된 일정이 없습니다.</p>
              <p className="text-sm mt-2">일정을 추가하여 월별 활동을 확인해보세요!</p>
            </div>
          )}
        </div>
      </div>

      {/* DetailedCalendar 렌더링 */}
      <DetailedCalendar {...detailedCalendarProps} />
    </div>
  );
};

export default AdminMemberView;
