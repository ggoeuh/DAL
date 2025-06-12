// pages/AdminMemberView.jsx - 단순화된 관리자 멤버 뷰 (DetailedCalendar 연결용)
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DetailedCalendar from './DetailedCalendar';

const AdminMemberView = ({ currentUser, onLogout, getUserData }) => {
  const { memberName } = useParams();
  const navigate = useNavigate();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 강력한 디버깅
  console.log('🔍 AdminMemberView 렌더링:', {
    currentUser, 
    memberName,
    getUserData: !!getUserData
  });

  useEffect(() => {
    console.log('🔍 AdminMemberView useEffect 실행:', { memberName, getUserData: !!getUserData });
    
    if (memberName && getUserData) {
      console.log('🔍 멤버 데이터 로딩 시작:', memberName);
      try {
        const data = getUserData(memberName);
        console.log('🔍 멤버 데이터 로딩 완료:', data);
        setMemberData(data);
      } catch (error) {
        console.error('🔍 멤버 데이터 로딩 오류:', error);
        setMemberData(null);
      }
      setLoading(false);
    } else {
      console.error('🔍 멤버 데이터 로딩 실패 - 파라미터 누락:', { 
        memberName: !!memberName, 
        getUserData: !!getUserData 
      });
      setLoading(false);
    }
  }, [memberName, getUserData]);

  const handleBackToDashboard = () => {
    navigate('/admin');
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

  if (!memberData) {
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
                  👑 {memberName}님의 상세 캘린더 (읽기 전용)
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

        {/* 데이터 없음 메시지 */}
        <div className="p-8">
          <div className="bg-white rounded-lg shadow p-6 text-center max-w-md mx-auto">
            <div className="text-gray-400 text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">데이터가 없습니다</h3>
            <p className="text-gray-500 mb-4">{memberName}님의 데이터를 찾을 수 없습니다.</p>
            <button
              onClick={handleBackToDashboard}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              대시보드로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  console.log('🔍 memberData가 있음, DetailedCalendar 렌더링');

  // DetailedCalendar에 전달할 props 준비
  const detailedCalendarProps = {
    schedules: memberData.schedules || [],
    tags: memberData.tags || [],
    tagItems: memberData.tagItems || [],
    monthlyGoals: memberData.monthlyGoals || [],
    currentUser: memberName, // 조회 대상 멤버 이름
    isAdminView: true, // 관리자 뷰 모드
    onLogout: onLogout,
    onBackToDashboard: handleBackToDashboard
  };

  return (
    <DetailedCalendar {...detailedCalendarProps} />
  );
};

export default AdminMemberView;