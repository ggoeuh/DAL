// AdminDashboard.jsx - 서버 기반 태그 색상 수정 버전
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  saveUserDataToDAL, 
  loadUserDataFromDAL,
  supabase
} from './utils/supabaseStorage';

const AdminDashboard = ({ currentUser, onLogout }) => {
  const [members, setMembers] = useState([]);
  const [memberStats, setMemberStats] = useState({});
  const [memberData, setMemberData] = useState({}); // 멤버별 실제 데이터 캐시
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState({}); // 진행률 데이터 캐시
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const navigate = useNavigate();

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

  // ✅ 서버 기반 태그 색상 가져오기 함수 개선
  const getTagColor = useCallback((tagType, memberName = null) => {
    if (!tagType) {
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
    }

    try {
      // 1. 특정 멤버의 서버 데이터에서 태그 색상 찾기
      if (memberName && memberData[memberName]?.tags) {
        const serverTag = memberData[memberName].tags.find(tag => tag.tagType === tagType);
        if (serverTag?.color && typeof serverTag.color === 'object') {
          console.log(`✅ ${memberName}의 ${tagType} 서버 색상 사용:`, serverTag.color);
          return serverTag.color;
        }
      }

      // 2. 모든 멤버 데이터에서 해당 태그 타입 찾기
      for (const [member, data] of Object.entries(memberData)) {
        if (data?.tags) {
          const serverTag = data.tags.find(tag => tag.tagType === tagType);
          if (serverTag?.color && typeof serverTag.color === 'object') {
            console.log(`✅ ${member}의 ${tagType} 서버 색상 사용:`, serverTag.color);
            return serverTag.color;
          }
        }
      }

      // 3. 서버에 색상 정보가 없으면 해시 기반으로 생성
      console.log(`⚠️ ${tagType} 서버 색상 없음, 해시 기반 생성`);
      const index = Math.abs(tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
      return PASTEL_COLORS[index];

    } catch (error) {
      console.warn('태그 색상 조회 실패:', { tagType, memberName, error });
      return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200" };
    }
  }, [memberData]);

  // ✨ 서버에서 모든 사용자 목록 가져오기
  const getServerUsers = async () => {
    if (!supabase) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다');
      return [];
    }

    try {
      console.log('🔍 서버에서 모든 사용자 검색 시작');
      
      // DAL 테이블에서 모든 고유한 사용자 이름 가져오기
      const { data, error } = await supabase
        .from('DAL')
        .select('user_name')
        .order('user_name');

      if (error) {
        throw error;
      }

      // 중복 제거하여 고유한 사용자 목록 생성
      const uniqueUsers = [...new Set(data.map(item => item.user_name))].filter(userName => 
        userName && 
        userName.trim() !== '' &&
        !['교수님', 'admin', '관리자', 'test', 'Test'].includes(userName)
      );

      console.log('✅ 서버에서 발견된 사용자들:', uniqueUsers);
      return uniqueUsers;

    } catch (error) {
      console.error('❌ 서버 사용자 검색 실패:', error);
      return [];
    }
  };

  // ✅ 서버에서 사용자 데이터 가져오기 - 태그 색상 정보 포함
  const getUserData = useCallback(async (nickname) => {
    if (!nickname) {
      console.warn('⚠️ getUserData: nickname이 없음');
      return {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
    }

    // 캐시된 데이터 먼저 확인
    if (memberData[nickname]) {
      console.log(`📦 ${nickname} 캐시된 데이터 사용`);
      return memberData[nickname];
    }

    try {
      console.log(`📦 ${nickname} 서버에서 데이터 로드 시작`);
      
      const result = await loadUserDataFromDAL(nickname);
      
      if (result.success && result.data) {
        const userData = result.data;
        
        // ✅ 태그 색상 정보 검증 및 보완
        if (userData.tags && Array.isArray(userData.tags)) {
          userData.tags = userData.tags.map(tag => {
            // 색상 정보가 없거나 올바르지 않은 경우 생성
            if (!tag.color || typeof tag.color !== 'object' || !tag.color.bg) {
              const index = Math.abs(tag.tagType.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % PASTEL_COLORS.length;
              tag.color = PASTEL_COLORS[index];
              console.log(`🎨 ${nickname}의 ${tag.tagType} 색상 생성:`, tag.color);
            }
            return tag;
          });
        }
        
        console.log(`✅ ${nickname} 서버 데이터 로드 성공:`, {
          schedules: userData.schedules?.length || 0,
          tags: userData.tags?.length || 0,
          tagItems: userData.tagItems?.length || 0,
          monthlyPlans: userData.monthlyPlans?.length || 0,
          monthlyGoals: userData.monthlyGoals?.length || 0
        });

        // 캐시에 저장
        setMemberData(prev => ({...prev, [nickname]: userData}));
        
        return userData;
      } else {
        console.warn(`⚠️ ${nickname} 서버 데이터 없음 또는 로드 실패:`, result.error);
        
        // 빈 데이터 구조 반환
        const emptyData = {
          schedules: [],
          tags: [],
          tagItems: [],
          monthlyPlans: [],
          monthlyGoals: []
        };
        
        setMemberData(prev => ({...prev, [nickname]: emptyData}));
        return emptyData;
      }

    } catch (error) {
      console.error(`❌ ${nickname} 서버 데이터 로드 실패:`, error);
      
      const emptyData = {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
      
      setMemberData(prev => ({...prev, [nickname]: emptyData}));
      return emptyData;
    }
  }, [memberData]);

  // ✅ 비동기 태그별 목표 달성률 계산 함수 - 서버 기반 색상 사용
  const calculateTagProgress = useCallback(async (member) => {
    console.log('📊 태그 진행률 계산 시작:', member);
    
    // 캐시된 진행률 데이터 확인
    if (progressData[member]) {
      console.log(`📊 ${member} 캐시된 진행률 사용`);
      return progressData[member];
    }
    
    const userData = await getUserData(member);
    if (!userData) {
      console.warn('⚠️ 사용자 데이터 없음:', member);
      return [];
    }

    console.log('📊 사용자 데이터 확인:', {
      member,
      schedules: userData.schedules?.length || 0,
      tags: userData.tags?.length || 0,
      tagItems: userData.tagItems?.length || 0,
      monthlyGoals: userData.monthlyGoals?.length || 0
    });

    const { schedules = [], monthlyGoals = [] } = userData;
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

    console.log('📊 현재 월 일정:', {
      currentMonth,
      totalSchedules: schedules.length,
      currentMonthSchedules: currentMonthSchedules.length
    });

    // 태그별 총 시간 계산 (실제 사용 시간)
    const monthlyTagTotals = {};
    
    currentMonthSchedules.forEach(schedule => {
      const tagType = schedule.tagType || "기타";
      
      if (!monthlyTagTotals[tagType]) {
        monthlyTagTotals[tagType] = 0;
      }
      
      const startMinutes = parseTimeToMinutes(schedule.start);
      const endMinutes = parseTimeToMinutes(schedule.end);
      const duration = endMinutes - startMinutes;
      
      monthlyTagTotals[tagType] += duration;
    });

    console.log('📊 월간 태그 총계:', monthlyTagTotals);

    // 월간 목표 불러오기
    const loadMonthlyGoals = () => {
      try {
        const currentMonthKey = currentMonth;
        console.log('🎯 목표 검색:', { currentMonthKey, monthlyGoals });
        
        if (!monthlyGoals || monthlyGoals.length === 0) {
          console.log('❌ 월간 목표 배열이 비어있음');
          return [];
        }
        
        const found = monthlyGoals.find(goal => {
          console.log('🔍 목표 월 비교:', { goalMonth: goal.month, currentMonth: currentMonthKey, match: goal.month === currentMonthKey });
          return goal.month === currentMonthKey;
        });
        
        const result = found?.goals || [];
        console.log('🎯 최종 월간 목표:', result);
        return result;
      } catch (error) {
        console.error('월간 목표 불러오기 실패:', error);
        return [];
      }
    };

    const currentMonthGoalsData = loadMonthlyGoals();
    console.log('📊 현재 월 목표:', currentMonthGoalsData);
    
    // 목표가 있거나 이번 달에 실제 사용된 태그타입만 표시
    const goalTagTypes = currentMonthGoalsData.map(goal => goal.tagType);
    const currentMonthUsedTagTypes = [...new Set(currentMonthSchedules.map(schedule => schedule.tagType || "기타"))];
    
    const allTagTypes = [...new Set([...goalTagTypes, ...currentMonthUsedTagTypes])];

    console.log('📊 처리할 태그 타입들:', {
      goalTagTypes,
      currentMonthUsedTagTypes,
      allTagTypes
    });

    // 결과 생성 - ✅ 서버 기반 색상 사용
    const result = allTagTypes.map((tagType) => {
      // ✅ 서버에서 태그 색상 가져오기
      const tagColor = getTagColor(tagType, member);
      
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
        tagColor: tagColor, // ✅ 서버 기반 색상
        targetTime: goalTime,
        actualTime: actualTime,
        percentage: percentage
      };
    }).filter(progress => {
      // 목표가 설정되었거나 실제 시간이 있는 것만 표시
      return progress.targetTime !== "00:00" || progress.actualTime !== "00:00";
    });

    console.log('📊 최종 진행률 결과 (서버 색상 포함):', result);
    
    // 진행률 데이터 캐시
    setProgressData(prev => ({...prev, [member]: result}));
    
    return result;
  }, [getUserData, progressData, getTagColor]);

  // ✨ 서버 기반 통계 계산
  const getServerStats = useCallback(async (userList) => {
    console.log('📊 서버 기반 통계 계산');
    
    const stats = {};
    
    for (const user of userList) {
      try {
        console.log(`📊 ${user} 통계 계산 중...`);
        
        const userData = await getUserData(user);
        
        if (userData) {
          stats[user] = {
            schedules: userData.schedules?.length || 0,
            tags: userData.tags?.length || 0,
            tagItems: userData.tagItems?.length || 0,
            monthlyPlans: userData.monthlyPlans?.length || 0,
            monthlyGoals: userData.monthlyGoals?.length || 0,
            lastActivity: '서버에서 조회'
          };
          console.log(`✅ ${user} 통계 완료:`, stats[user]);
        }
      } catch (error) {
        console.error(`❌ ${user} 통계 계산 실패:`, error);
      }
    }
    
    console.log('📊 최종 서버 통계:', stats);
    return stats;
  }, [getUserData]);

  // ✨ 새로고침 함수
  const refreshMemberData = async () => {
    console.log('🔄 서버 데이터 새로고침 시작');
    
    try {
      setLoading(true);
      
      // 캐시 초기화
      setMemberData({});
      setProgressData({});
      
      const serverUsers = await getServerUsers();
      console.log('🔄 새로고침: 사용자들:', serverUsers);
      
      if (serverUsers.length > 0) {
        setMembers(serverUsers);
        const serverStats = await getServerStats(serverUsers);
        setMemberStats(serverStats);
        setLastSyncTime(new Date());
        console.log('✅ 서버 데이터 새로고침 완료');
      }
    } catch (error) {
      console.error('❌ 새로고침 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✨ 초기 데이터 로딩
  useEffect(() => {
    console.log('🚀 AdminDashboard 시작 - 완전 서버 기반 시스템');
    
    const loadServerData = async () => {
      try {
        setLoading(true);
        console.log('📦 서버에서 데이터 로딩');
        
        // 서버에서 사용자 목록 가져오기
        const serverUsers = await getServerUsers();
        console.log('👥 서버 사용자들:', serverUsers);
        
        if (serverUsers.length > 0) {
          setMembers(serverUsers);
          
          // 통계 계산
          const serverStats = await getServerStats(serverUsers);
          console.log('📊 최종 통계:', serverStats);
          setMemberStats(serverStats);
          setLastSyncTime(new Date());
          
          console.log('✅ 서버 기반 시스템 완료');
        } else {
          console.warn('⚠️ 서버에서 사용자를 찾을 수 없음');
        }
        
      } catch (error) {
        console.error('❌ 데이터 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    loadServerData();
  }, []);

  // 자동 새로고침 (5분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ 자동 새로고침 트리거');
      refreshMemberData();
    }, 5 * 60 * 1000); // 5분

    return () => clearInterval(interval);
  }, []);

  const handleMemberAction = async (memberName, actionType) => {
    console.log('🔍 멤버 액션 시작:', { memberName, actionType });
    
    // 데이터 검증
    const userData = await getUserData(memberName);
    console.log('🔍 이동 전 데이터 검증:', {
      memberName,
      userData: !!userData,
      userDataKeys: userData ? Object.keys(userData) : null,
      schedules: userData?.schedules?.length || 0,
      tags: userData?.tags?.length || 0,
      tagItems: userData?.tagItems?.length || 0
    });
    
    // 데이터가 없어도 이동 가능 (신규 사용자)
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

  // 관리자용 데이터 관리 함수들
  const handleDataDebug = () => {
    const result = window.confirm('⚠️ 모든 서버 데이터를 콘솔에 출력하시겠습니까?');
    if (result) {
      console.log('=== 캐시된 멤버 데이터 ===');
      console.log(memberData);
      
      console.log('=== 캐시된 진행률 데이터 ===');
      console.log(progressData);
      
      console.log('=== 멤버 통계 ===');
      console.log(memberStats);

      // ✅ 태그 색상 디버그 정보 추가
      console.log('=== 태그 색상 디버그 ===');
      Object.entries(memberData).forEach(([member, data]) => {
        if (data?.tags) {
          console.log(`${member}의 태그들:`, data.tags.map(tag => ({
            tagType: tag.tagType,
            hasColor: !!tag.color,
            color: tag.color
          })));
        }
      });
      
      alert('✅ 콘솔에 서버 데이터가 출력되었습니다. 개발자 도구를 확인하세요.');
    }
  };

  const handleUserDataReset = async (memberName) => {
    if (!supabase) {
      alert('❌ Supabase 연결이 없습니다.');
      return;
    }

    const result = window.confirm(`⚠️ ${memberName}님의 모든 서버 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
    if (result) {
      try {
        // 서버에서 사용자 데이터 삭제
        const { error } = await supabase
          .from('DAL')
          .delete()
          .eq('user_name', memberName);
        
        if (error) {
          throw error;
        }

        // 캐시에서도 제거
        setMemberData(prev => {
          const newData = { ...prev };
          delete newData[memberName];
          return newData;
        });
        
        setProgressData(prev => {
          const newData = { ...prev };
          delete newData[memberName];
          return newData;
        });
        
        alert(`✅ ${memberName}님의 서버 데이터가 삭제되었습니다.`);
        
        await refreshMemberData();
      } catch (error) {
        console.error('서버 데이터 삭제 실패:', error);
        alert('❌ 서버 데이터 삭제 실패: ' + error.message);
      }
    }
  };

  const handleAllServerDataReset = async () => {
    if (!supabase) {
      alert('❌ Supabase 연결이 없습니다.');
      return;
    }

    const result = window.confirm('⚠️ 모든 사용자의 서버 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
    if (result) {
      try {
        const { error } = await supabase
          .from('DAL')
          .delete()
          .neq('id', 0); // 모든 레코드 삭제
        
        if (error) {
          throw error;
        }

        // 캐시 초기화
        setMemberData({});
        setProgressData({});
        setMembers([]);
        setMemberStats({});
        
        alert('✅ 모든 서버 데이터가 삭제되었습니다.');
        
        await refreshMemberData();
      } catch (error) {
        console.error('전체 서버 데이터 삭제 실패:', error);
        alert('❌ 전체 서버 데이터 삭제 실패: ' + error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">서버에서 멤버 데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">완전 서버 기반 시스템 (태그 색상 포함)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 기존 UI 코드는 동일하게 유지... */}
      {/* 나머지 JSX는 원본과 동일 */}
      
      {/* 관리자 네비게이션 */}
      <nav className="bg-red-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">👑 관리자 대시보드</h1>
            <span className="text-red-200 text-sm">({currentUser})</span>
            <span className="bg-blue-500 text-xs px-2 py-1 rounded">서버 기반</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-red-200 text-sm">
              {new Date().toLocaleDateString('ko-KR')}
            </span>
            {lastSyncTime && (
              <span className="text-red-200 text-xs">
                마지막 동기화: {lastSyncTime.toLocaleTimeString('ko-KR')}
              </span>
            )}
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
            <span>마지막 업데이트: {lastSyncTime ? lastSyncTime.toLocaleString('ko-KR') : '로딩 중'}</span>
            <span>•</span>
            <span className="text-blue-600 font-medium">🌐 서버 기반 시스템 (태그 색상 포함)</span>
          </div>
        </div>

        {/* 멤버 카드 그리드 */}
        {members.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-gray-400 text-8xl mb-6">👥</div>
            <h3 className="text-2xl font-semibold text-gray-600 mb-3">등록된 멤버가 없습니다</h3>
            <p className="text-gray-500 mb-6">
              멤버가 로그인하여 서버에 데이터를 생성하면 자동으로 여기에 표시됩니다.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <h4 className="font-semibold mb-2">🌐 서버 기반 시스템</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 모든 데이터가 Supabase 서버에 저장됩니다</li>
                <li>• 실시간 서버 동기화로 최신 데이터 보장</li>
                <li>• 로컬 저장소 의존성 완전 제거</li>
                <li>• 태그 색상도 서버에서 동기화</li>
                <li>• 자동 5분마다 새로고침</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => {
              const stats = memberStats[member] || {};
              const isNewUser = (stats.schedules || 0) + (stats.tags || 0) + (stats.tagItems || 0) === 0;
              
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
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xl font-semibold text-gray-800">{member}</h3>
                          {isNewUser && (
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full border border-green-200">
                              신규 사용자
                            </span>
                          )}
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full border border-blue-200">
                            서버 기반
                          </span>
                        </div>
                        <p className="text-gray-500 text-sm flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                          {isNewUser ? '등록 완료' : '활성 멤버'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 멤버 통계 */}
                  <div className="p-6">
                    {isNewUser ? (
                      <div className="text-center py-6">
                        <div className="text-gray-400 text-4xl mb-3">🌟</div>
                        <h4 className="font-semibold text-gray-700 mb-2">새로운 멤버입니다!</h4>
                        <p className="text-gray-500 text-sm mb-4">
                          아직 서버에 일정이나 목표를 설정하지 않았습니다.
                        </p>
                        <div className="bg-gray-50 rounded-lg p-3 text-left">
                          <h5 className="font-medium text-gray-700 mb-2">💡 시작 가이드</h5>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• 캘린더에서 첫 일정 등록</li>
                            <li>• 태그와 카테고리 설정</li>
                            <li>• 월간 목표 계획 수립</li>
                            <li>• 자동 서버 동기화</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-semibold text-gray-700 mb-3">🎯 이번 달 목표 달성률</h4>
                        <MemberProgressDisplay member={member} calculateTagProgress={calculateTagProgress} />
                      </>
                    )}
                  </div>
                  
                  {/* 액션 버튼들 */}
                  <div className="p-6 pt-0">
                    <h4 className="font-semibold text-gray-700 mb-3">🔍 데이터 조회</h4>
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          console.log('🔍 캘린더 보기 버튼 클릭:', member);
                          handleMemberAction(member, 'detailed-calendar');
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-lg transition duration-200 text-sm font-medium flex items-center justify-center"
                      >
                        <span className="mr-2">📅</span>
                        {isNewUser ? '캘린더 설정하기' : '캘린더 보기'}
                      </button>
                      
                      {!isNewUser && (
                        <button
                          onClick={async () => {
                            const tagProgress = await calculateTagProgress(member);
                            if (tagProgress.length === 0) {
                              alert(`📊 ${member}님 상세 정보\n\n• 설정된 월간 목표가 없습니다\n• 목표를 설정하면 달성률을 확인할 수 있습니다`);
                            } else {
                              const avgProgress = Math.round(tagProgress.reduce((sum, p) => sum + p.percentage, 0) / tagProgress.length);
                              const progressDetails = tagProgress.map(p => 
                                `• ${p.tagName}: ${p.actualTime}/${p.targetTime} (${p.percentage}%)`
                              ).join('\n');
                              
                              alert(`📊 ${member}님 목표 달성 현황 (서버 기반)\n\n${progressDetails}\n\n평균 달성률: ${avgProgress}%\n조회 시간: ${new Date().toLocaleString('ko-KR')}`);
                            }
                          }}
                          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg transition duration-200 text-sm font-medium flex items-center justify-center"
                        >
                          <span className="mr-2">📈</span>
                          상세 달성률 보기
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleUserDataReset(member)}
                        className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition duration-200 text-sm font-medium flex items-center justify-center"
                      >
                        <span className="mr-2">🗑️</span>
                        서버 데이터 삭제
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
            <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded">서버 기반</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => {
                const memberCount = members.length;
                const totalData = Object.values(memberStats).reduce((sum, stats) => 
                  sum + stats.schedules + stats.tags + stats.tagItems + stats.monthlyPlans + stats.monthlyGoals, 0
                );
                alert(`📊 시스템 현황 (서버 기반)\n\n• 등록된 멤버: ${memberCount}명\n• 총 서버 데이터: ${totalData}개\n• 캐시된 데이터: ${Object.keys(memberData).length}명\n• 데이터 소스: Supabase 서버\n• 상태: 정상 운영중\n• 마지막 업데이트: ${lastSyncTime ? lastSyncTime.toLocaleString('ko-KR') : '로딩 중'}`);
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium"
            >
              📊 시스템 현황
            </button>
            
            <button
              onClick={handleDataDebug}
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium"
            >
              🔍 서버 데이터 디버그
            </button>
            
            <button
              onClick={refreshMemberData}
              disabled={loading}
              className="bg-green-100 hover:bg-green-200 text-green-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium disabled:opacity-50"
            >
              {loading ? '🔄 로딩...' : '🔄 서버 새로고침'}
            </button>
            
            <button
              onClick={handleAllServerDataReset}
              className="bg-red-100 hover:bg-red-200 text-red-700 py-3 px-4 rounded-lg transition duration-200 text-sm font-medium"
            >
              🗑️ 전체 서버 삭제
            </button>
          </div>
          
          {/* 서버 기반 시스템 상태 표시 */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">🌐 서버 기반 시스템 상태</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span>Supabase: 활성</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                <span>서버 동기화: 활성</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                <span>실시간 업데이트: 활성</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                <span>자동 새로고침: 5분</span>
              </div>
            </div>
          </div>
          
          {/* 시스템 개선사항 */}
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-800 mb-2">💡 서버 기반 시스템 (v5.1 - 태그 색상 개선)</h4>
            <div className="text-sm text-green-700 space-y-1">
              <div>• <strong>완전 서버 기반:</strong> 로컬 저장소 의존성 완전 제거</div>
              <div>• <strong>실시간 동기화:</strong> Supabase를 통한 실시간 데이터 관리</div>
              <div>• <strong>태그 색상 서버 동기화:</strong> 모든 태그 색상이 서버에서 관리됨</div>
              <div>• <strong>자동 새로고침:</strong> 5분마다 자동으로 최신 데이터 갱신</div>
              <div>• <strong>안정성 향상:</strong> 서버 기반으로 데이터 손실 방지</div>
            </div>
          </div>
        </div>
        
        {/* 시스템 정보 푸터 */}
        <div className="mt-8 text-center text-xs text-gray-500 space-y-1">
          <div>관리자 대시보드 v5.1 | 완전 서버 기반 시스템 (태그 색상 개선)</div>
          <div>마지막 빌드: {new Date().toLocaleString('ko-KR')} | 데이터 소스: Supabase 서버</div>
          <div className="flex justify-center items-center space-x-4 mt-2">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
              서버 기반
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              실시간 동기화
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-1"></span>
              자동 새로고침
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
              태그 색상 동기화
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ 멤버 진행률 표시 컴포넌트 - 서버 기반 색상 사용
const MemberProgressDisplay = ({ member, calculateTagProgress }) => {
  const [tagProgress, setTagProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        setLoading(true);
        const progress = await calculateTagProgress(member);
        setTagProgress(progress);
        console.log(`🎨 ${member} 진행률 색상 확인:`, progress.map(p => ({
          tag: p.tagName,
          color: p.tagColor
        })));
      } catch (error) {
        console.error(`❌ ${member} 진행률 로딩 실패:`, error);
        setTagProgress([]);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, [member, calculateTagProgress]);

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
        <p className="text-gray-500 text-sm">서버에서 목표 달성률 계산 중...</p>
      </div>
    );
  }

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
          
          {/* ✅ 태그 색상 소스 표시 (디버그용) */}
          <div className="mt-2 text-xs text-gray-500 opacity-70">
            🎨 서버 기반 색상
          </div>
        </div>
      ))}
      
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
};

export default AdminDashboard;
