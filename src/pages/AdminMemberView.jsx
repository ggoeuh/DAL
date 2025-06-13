// AdminMemberView.jsx - 완전 서버 기반 버전
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';
import DetailedCalendar from './DetailedCalendar';

const AdminMemberView = ({ currentUser, onLogout }) => {
  const { memberName } = useParams();
  const navigate = useNavigate();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  console.log('🔍 AdminMemberView 렌더링 (서버 기반):', {
    currentUser, 
    memberName
  });

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

      {/* DetailedCalendar 렌더링 */}
      <DetailedCalendar {...detailedCalendarProps} />
    </div>
  );
};

export default AdminMemberView;
