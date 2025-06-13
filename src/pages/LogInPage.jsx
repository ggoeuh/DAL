// pages/LogInPage.jsx - 완전 수정 버전
import React, { useState } from 'react';

const ALLOWED_USERS = {
  members: ['고은', '소윤', '예진', '도훈', '신아', '수진'],
  admins: ['교수님'] // 기존 그대로 유지
};

const USER_TYPE_COLORS = {
  member: {
    bg: 'bg-blue-500 hover:bg-blue-600',
    ring: 'focus:ring-blue-400',
    border: 'border-blue-300'
  },
  admin: {
    bg: 'bg-red-500 hover:bg-red-600',
    ring: 'focus:ring-red-400',
    border: 'border-red-300'
  }
};

function LogInPage() {
  const [userType, setUserType] = useState('member');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = () => {
    // 중복 실행 방지
    if (isLoggingIn) {
      console.log('이미 로그인 처리 중');
      return;
    }
    
    const trimmedNickname = nickname.trim();
    
    // 입력 검증
    if (!trimmedNickname) {
      setError('이름을 입력해주세요.');
      return;
    }

    console.log('로그인 시도:', { userType, nickname: trimmedNickname });
    
    setIsLoggingIn(true);
    setError('');

    // ✨ 수정된 사용자 검증 로직
    const allowedList = ALLOWED_USERS[userType + 's']; // members 또는 admins
    
    // 정확한 문자열 매칭 (대소문자 구분 없이)
    const isValidUser = allowedList.some(user => 
      user.toLowerCase().trim() === trimmedNickname.toLowerCase().trim()
    );

    console.log('🔍 사용자 검증:', {
      userType,
      allowedList,
      trimmedNickname,
      isValidUser
    });

    if (!isValidUser) {
      setError(`허용되지 않은 ${userType === 'admin' ? '관리자' : '멤버'}입니다.`);
      setIsLoggingIn(false);
      return;
    }

    // 로그인 성공 처리
    try {
      console.log('✅ 로그인 성공');
      
      // ✨ localStorage에 저장 (userType도 함께 저장)
      localStorage.setItem('nickname', trimmedNickname);
      localStorage.setItem('userType', userType); // 중요: userType 저장
      
      console.log('💾 localStorage 저장 완료:', {
        nickname: trimmedNickname,
        userType: userType
      });
      
      // 즉시 페이지 이동
      const targetUrl = userType === 'admin' ? '/admin' : '/calendar';
      console.log(`🚀 ${targetUrl}로 이동`);
      
      // ✨ 상태 업데이트 후 페이지 이동 (약간의 지연)
      setTimeout(() => {
        window.location.href = targetUrl === '/admin' ? '#/admin' : '#/calendar';
      }, 100);
      
    } catch (error) {
      console.error('❌ 로그인 처리 실패:', error);
      setError('로그인 처리 중 오류가 발생했습니다.');
      setIsLoggingIn(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoggingIn) {
      handleLogin();
    }
  };

  const handleUserTypeChange = (newType) => {
    if (isLoggingIn) return;
    
    setUserType(newType);
    setNickname('');
    setError('');
  };

  const currentColors = USER_TYPE_COLORS[userType];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-sm w-full space-y-6">
        {/* 제목 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            시스템 로그인
          </h1>
          <p className="text-sm text-gray-500">
            사용자 타입을 선택하고 로그인하세요
          </p>
        </div>
        
        {/* 사용자 타입 선택 */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            사용자 타입
          </label>
          <div className="flex space-x-4">
            <button
              type="button"
              disabled={isLoggingIn}
              onClick={() => handleUserTypeChange('member')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                userType === 'member'
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-2 border-gray-300 hover:bg-gray-200'
              } ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              👤 멤버
            </button>
            <button
              type="button"
              disabled={isLoggingIn}
              onClick={() => handleUserTypeChange('admin')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                userType === 'admin'
                  ? 'bg-red-100 text-red-700 border-2 border-red-300 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-2 border-gray-300 hover:bg-gray-200'
              } ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              👑 관리자
            </button>
          </div>
        </div>

        {/* 이름 입력 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {userType === 'admin' ? '관리자 이름' : '멤버 이름'}
          </label>
          <input
            type="text"
            placeholder={`${userType === 'admin' ? '관리자' : '멤버'} 이름을 입력하세요`}
            value={nickname}
            disabled={isLoggingIn}
            onChange={(e) => setNickname(e.target.value)}
            onKeyPress={handleKeyPress}
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all duration-200 ${
              currentColors.ring
            } ${currentColors.border} ${
              isLoggingIn 
                ? 'bg-gray-100 cursor-not-allowed' 
                : 'bg-white hover:border-gray-400'
            }`}
            autoComplete="off"
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 animate-pulse">
            <div className="flex items-center">
              <span className="text-red-400 mr-2">⚠️</span>
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* 로그인 중 상태 */}
        {isLoggingIn && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-3"></div>
              <p className="text-blue-600 text-sm font-medium">로그인 처리 중...</p>
            </div>
          </div>
        )}

        {/* 로그인 버튼 */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn || !nickname.trim()}
          className={`w-full py-3 rounded-md font-medium transition-all duration-200 ${
            isLoggingIn || !nickname.trim()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : `${currentColors.bg} text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5`
          }`}
        >
          {isLoggingIn 
            ? '로그인 중...' 
            : `${userType === 'admin' ? '관리자' : '멤버'}로 입장`
          }
        </button>

        {/* 허용된 사용자 안내 */}
        <div className="bg-gray-50 rounded-md p-4">
          <p className="text-sm font-medium text-gray-700 mb-3 text-center">허용된 사용자</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-600 font-medium">👤 멤버:</span>
              <span className="text-xs text-gray-600">{ALLOWED_USERS.members.join(', ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-red-600 font-medium">👑 관리자:</span>
              <span className="text-xs text-gray-600">{ALLOWED_USERS.admins.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* 디버깅 정보 */}
        <div className="border-t pt-4">
          <div className="text-center text-xs text-gray-400 space-y-1">
            <p>현재 경로: <span className="font-mono">{window.location.pathname}</span></p>
            <p>저장된 사용자: <span className="font-mono">{localStorage.getItem('nickname') || '없음'}</span></p>
            <p>사용자 타입: <span className="font-mono">{localStorage.getItem('userType') || '없음'}</span></p>
          </div>
          <div className="flex justify-center mt-3">
            <button
              onClick={() => {
                if (window.confirm('🗑️ 모든 저장된 데이터를 삭제하고 새로 시작하시겠습니까?')) {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }
              }}
              className="text-xs text-red-400 hover:text-red-600 underline transition-colors duration-200"
            >
              전체 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogInPage;
