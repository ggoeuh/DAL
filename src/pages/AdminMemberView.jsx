// AdminMemberView.jsx - 월간 목표 표시 문제 해결 버전
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadUserDataWithFallback, loadAllUserData } from './utils/unifiedStorage';
import DetailedCalendar from './DetailedCalendar';

const AdminMemberView = ({ currentUser, onLogout }) => {
  const { memberName } = useParams();
  const navigate = useNavigate();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log('🔍 AdminMemberView 렌더링:', {
    currentUser, 
    memberName
  });

  // ✨ 하이브리드 데이터 로딩으로 수정
  useEffect(() => {
    console.log('🔍 AdminMemberView useEffect 실행:', { memberName });
    
    if (!memberName) {
      setError('멤버 이름이 제공되지 않았습니다');
      setLoading(false);
      return;
    }

    const loadMemberData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔍 하이브리드 데이터 로딩 시작:', memberName);
        
        let serverData = null;
        let localData = null;
        
        // 1단계: 서버에서 데이터 로드 시도
        try {
          serverData = await loadUserDataWithFallback(memberName);
          console.log('✅ 서버 데이터 로드 성공:', {
            memberName,
            schedules: serverData?.schedules?.length || 0,
            tags: serverData?.tags?.length || 0,
            tagItems: serverData?.tagItems?.length || 0,
            monthlyGoals: serverData?.monthlyGoals?.length || 0
          });
        } catch (serverError) {
          console.error('⚠️ 서버 로드 실패, localStorage 시도:', serverError);
        }
        
        // 2단계: localStorage에서 데이터 로드 시도
        try {
          localData = loadAllUserData(memberName);
          console.log('✅ 로컬 데이터 로드 성공:', {
            memberName,
            schedules: localData?.schedules?.length || 0,
            tags: localData?.tags?.length || 0,
            tagItems: localData?.tagItems?.length || 0,
            monthlyGoals: localData?.monthlyGoals?.length || 0
          });
        } catch (localError) {
          console.error('⚠️ 로컬 로드 실패:', localError);
        }
        
        // 3단계: 데이터 존재 여부 확인
        if (!serverData && !localData) {
          throw new Error('서버와 로컬 저장소 모두에서 데이터 로드 실패');
        }
        
        // 4단계: 하이브리드 데이터 생성 (AdminDashboard와 동일한 로직)
        const hybridData = {
          // 일정: 서버 우선, 없으면 로컬
          schedules: (serverData?.schedules?.length > 0) 
            ? serverData.schedules 
            : (localData?.schedules || []),
            
          // 태그: 서버 우선, 없으면 로컬  
          tags: (serverData?.tags?.length > 0) 
            ? serverData.tags 
            : (localData?.tags || []),
            
          // 태그 아이템: 서버 우선, 없으면 로컬
          tagItems: (serverData?.tagItems?.length > 0) 
            ? serverData.tagItems 
            : (localData?.tagItems || []),
            
          // 월간 계획: 서버 우선, 없으면 로컬
          monthlyPlans: (serverData?.monthlyPlans?.length > 0) 
            ? serverData.monthlyPlans 
            : (localData?.monthlyPlans || []),
            
          // ✨ 핵심 수정: 월간 목표는 로컬 우선! (localStorage에 최신 목표가 있음)
          monthlyGoals: (localData?.monthlyGoals?.length > 0) 
            ? localData.monthlyGoals 
            : (serverData?.monthlyGoals || [])
        };
        
        console.log('🎯 하이브리드 최종 데이터:', {
          memberName,
          schedules: hybridData.schedules?.length || 0,
          tags: hybridData.tags?.length || 0,
          tagItems: hybridData.tagItems?.length || 0,
          monthlyPlans: hybridData.monthlyPlans?.length || 0,
          monthlyGoals: hybridData.monthlyGoals?.length || 0,
          monthlyGoalsSource: (localData?.monthlyGoals?.length > 0) ? 'localStorage' : 'server',
          dataStatus: {
            serverAvailable: !!serverData,
            localAvailable: !!localData,
            hasMonthlyGoals: hybridData.monthlyGoals?.length > 0
          }
        });
        
        // 5단계: 기본 구조 보장 (배열이 아닌 경우 빈 배열로 초기화)
        const validatedData = {
          schedules: Array.isArray(hybridData.schedules) ? hybridData.schedules : [],
          tags: Array.isArray(hybridData.tags) ? hybridData.tags : [],
          tagItems: Array.isArray(hybridData.tagItems) ? hybridData.tagItems : [],
          monthlyPlans: Array.isArray(hybridData.monthlyPlans) ? hybridData.monthlyPlans : [],
          monthlyGoals: Array.isArray(hybridData.monthlyGoals) ? hybridData.monthlyGoals : []
        };
        
        console.log('✅ 데이터 검증 완료:', {
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
        
      } catch (error) {
        console.error('❌ 하이브리드 데이터 로딩 최종 실패:', error);
        setError(error.message || '데이터 로딩 실패');
        setMemberData(null);
      } finally {
        setLoading(false);
      }
    };

    loadMemberData();
  }, [memberName]);

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">하이브리드 방식으로 {memberName}님의 데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">서버 + localStorage 통합 로딩...</p>
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
                <p className="text-red-200 text-sm">관리자: {currentUser}</p>
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

        {/* 데이터 로딩 실패 메시지 */}
        <div className="p-8">
          <div className="bg-white rounded-lg shadow p-6 text-center max-w-md mx-auto">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">하이브리드 데이터 로딩 실패</h3>
            <p className="text-gray-500 mb-4">
              {memberName}님의 데이터를 서버와 로컬 저장소에서 불러올 수 없습니다.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-700 text-sm">오류: {error}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-4">
              <h4 className="font-semibold mb-2">💡 해결 방법</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 해당 멤버가 로그인한 적이 있는지 확인</li>
                <li>• 서버 연결 상태와 localStorage 상태 확인</li>
                <li>• 브라우저를 새로고침하고 다시 시도</li>
                <li>• 대시보드에서 다시 접근</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                새로고침
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

  console.log('✅ AdminMemberView: DetailedCalendar 렌더링 준비 완료 (하이브리드 데이터)');

  // DetailedCalendar에 전달할 props 준비
  const detailedCalendarProps = {
    schedules: memberData.schedules || [],
    tags: memberData.tags || [],
    tagItems: memberData.tagItems || [],
    monthlyGoals: memberData.monthlyGoals || [], // ✨ localStorage 우선 데이터
    monthlyPlans: memberData.monthlyPlans || [],
    currentUser: memberName, // 조회 대상 멤버 이름
    isAdminView: true, // 관리자 뷰 모드
    onLogout: onLogout,
    onBackToDashboard: handleBackToDashboard
  };

  console.log('🔍 DetailedCalendar props (하이브리드):', {
    memberName,
    schedulesCount: detailedCalendarProps.schedules.length,
    tagsCount: detailedCalendarProps.tags.length,
    tagItemsCount: detailedCalendarProps.tagItems.length,
    monthlyGoalsCount: detailedCalendarProps.monthlyGoals.length, // ✨ 이제 목표가 보여야 함
    monthlyGoalsData: detailedCalendarProps.monthlyGoals,
    isAdminView: detailedCalendarProps.isAdminView
  });

  return (
    <DetailedCalendar {...detailedCalendarProps} />
  );
};

export default AdminMemberView;
