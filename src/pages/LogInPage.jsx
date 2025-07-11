// pages/LogInPage.jsx - 완전 서버 기반 버전
import React, { useState } from 'react';
import { loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';

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
  const [loginStatus, setLoginStatus] = useState('');
  const [serverConnected, setServerConnected] = useState(false);

  // ✨ 서버 연결 확인
  const checkServerConnection = async () => {
    try {
      if (!supabase) {
        throw new Error('Supabase 클라이언트가 초기화되지 않았습니다');
      }

      // 간단한 연결 테스트
      const { data, error } = await supabase
        .from('DAL')
        .select('id')
        .limit(1);

      if (error) {
        throw error;
      }

      setServerConnected(true);
      return true;
    } catch (error) {
      console.error('❌ 서버 연결 실패:', error);
      setServerConnected(false);
      return false;
    }
  };

  // ✨ 서버에서 사용자 데이터 확인
  const checkUserDataOnServer = async (userName) => {
    try {
      setLoginStatus('서버에서 사용자 데이터 확인 중...');
      
      const result = await loadUserDataFromDAL(userName);
      
      if (result.success && result.data) {
        const userData = result.data;
        const dataCount = {
          schedules: userData.schedules?.length || 0,
          tags: userData.tags?.length || 0,
          tagItems: userData.tagItems?.length || 0,
          monthlyGoals: userData.monthlyGoals?.length || 0
        };
        
        console.log(`✅ ${userName} 서버 데이터 확인:`, dataCount);
        
        return {
          hasData: dataCount.schedules > 0 || dataCount.tags > 0 || dataCount.tagItems > 0,
          dataCount
        };
      } else {
        console.log(`ℹ️ ${userName} 서버에 데이터 없음`);
        return {
          hasData: false,
          dataCount: { schedules: 0, tags: 0, tagItems: 0, monthlyGoals: 0 }
        };
      }
    } catch (error) {
      console.error('❌ 서버 데이터 확인 실패:', error);
      throw error;
    }
  };

  const handleLogin = async () => {
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
    setLoginStatus('');

    try {
      // 1단계: 서버 연결 확인
      setLoginStatus('서버 연결 확인 중...');
      const isServerConnected = await checkServerConnection();
      
      if (!isServerConnected) {
        throw new Error('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.');
      }

      // 2단계: 사용자 검증
      setLoginStatus('사용자 권한 확인 중...');
      const allowedList = ALLOWED_USERS[userType + 's']; // members 또는 admins
      
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
        throw new Error(`허용되지 않은 ${userType === 'admin' ? '관리자' : '멤버'}입니다.`);
      }

      // 3단계: 관리자는 바로 로그인, 멤버는 서버 데이터 확인
      if (userType === 'admin') {
        setLoginStatus('관리자 권한 확인 완료');
        
        // 관리자는 데이터 확인 없이 바로 로그인
        console.log('✅ 관리자 로그인 성공');
        
        // 세션 정보만 저장 (임시)
        sessionStorage.setItem('currentUser', trimmedNickname);
        sessionStorage.setItem('userType', userType);
        sessionStorage.setItem('loginTime', new Date().toISOString());
        
        setTimeout(() => {
          console.log('🚀 관리자 대시보드로 이동');
          window.location.href = '#/admin';
        }, 1000);
        
      } else {
        // 멤버인 경우 서버 데이터 확인
        const serverDataCheck = await checkUserDataOnServer(trimmedNickname);
        
        if (serverDataCheck.hasData) {
          setLoginStatus(`기존 데이터 발견: 일정 ${serverDataCheck.dataCount.schedules}개, 태그 ${serverDataCheck.dataCount.tags}개`);
        } else {
          setLoginStatus('신규 사용자로 확인됨');
        }
        
        console.log('✅ 멤버 로그인 성공');
        
        // 세션 정보 저장
        sessionStorage.setItem('currentUser', trimmedNickname);
        sessionStorage.setItem('userType', userType);
        sessionStorage.setItem('loginTime', new Date().toISOString());
        sessionStorage.setItem('serverDataStatus', JSON.stringify(serverDataCheck));
        
        // 멤버는 캘린더로 이동
        setTimeout(() => {
          console.log('🚀 캘린더로 이동');
          window.location.href = '#/calendar';
        }, 1500);
      }
      
    } catch (error) {
      console.error('❌ 로그인 처리 실패:', error);
      setError(error.message || '로그인 처리 중 오류가 발생했습니다.');
      setLoginStatus('');
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
    setLoginStatus('');
  };

  // ✨ 세션 정보 초기화
  const clearSessionData = () => {
    if (window.confirm('🗑️ 모든 세션 정보를 삭제하고 새로 시작하시겠습니까?\n\n⚠️ 주의: 서버의 데이터는 삭제되지 않습니다.')) {
      // 세션 정보만 삭제 (서버 데이터는 보존)
      sessionStorage.clear();
      
      // 상태 초기화
      setNickname('');
      setUserType('member');
      setError('');
      setLoginStatus('');
      setIsLoggingIn(false);
      setServerConnected(false);
      
      alert('✅ 세션 정보가 초기화되었습니다.\n서버의 데이터는 안전하게 보존되었습니다.');
    }
  };

  const currentColors = USER_TYPE_COLORS[userType];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-sm w-full space-y-6">
        {/* 제목 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            서버 기반 로그인
          </h1>
          <p className="text-sm text-gray-500">
            사용자 타입을 선택하고 로그인하세요
          </p>
          <div className="mt-2 flex justify-center items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            <span className="text-xs text-gray-600">
              {serverConnected ? 'Supabase 연결됨' : '서버 상태 확인 필요'}
            </span>
          </div>
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

        {/* ✨ 서버 기반 로그인 중 상태 표시 */}
        {isLoggingIn && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center mb-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-3"></div>
              <p className="text-blue-600 text-sm font-medium">
                {loginStatus || (userType === 'admin' ? '관리자 권한을 확인하는 중...' : '서버에서 사용자 데이터 확인 중...')}
              </p>
            </div>
            <div className="text-xs text-blue-500 space-y-1 mt-2">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${serverConnected ? 'bg-green-400' : 'bg-blue-400 animate-pulse'}`}></div>
                Supabase 서버 연결 확인
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                사용자 권한 검증
              </div>
              {userType === 'member' && (
                <>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                    서버 데이터 확인
                  </div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                    세션 정보 설정
                  </div>
                </>
              )}
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
            ? (userType === 'admin' ? '관리자 인증 중...' : '서버 데이터 확인 중...') 
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

        {/* ✨ 서버 기반 디버깅 정보 */}
        <div className="border-t pt-4">
          <div className="text-center text-xs text-gray-400 space-y-1">
            <p>현재 경로: <span className="font-mono">{window.location.pathname}</span></p>
            <p>현재 사용자: <span className="font-mono">{sessionStorage.getItem('currentUser') || '없음'}</span></p>
            <p>사용자 타입: <span className="font-mono">{sessionStorage.getItem('userType') || '없음'}</span></p>
            <p>로그인 시간: <span className="font-mono">{sessionStorage.getItem('loginTime') ? new Date(sessionStorage.getItem('loginTime')).toLocaleTimeString('ko-KR') : '없음'}</span></p>
            <p className="text-[10px] text-gray-300">서버 기반 시스템 - {new Date().toLocaleString('ko-KR')}</p>
          </div>
          <div className="flex justify-center mt-3">
            <button
              onClick={clearSessionData}
              disabled={isLoggingIn}
              className="text-xs text-red-400 hover:text-red-600 underline transition-colors duration-200"
            >
              {isLoggingIn ? '처리 중...' : '세션 정보 초기화'}
            </button>
          </div>
          
          {/* ✨ 서버 데이터 보호 안내 */}
          <div className="mt-3 p-2 bg-green-50 rounded text-center">
            <p className="text-xs text-green-600">
              🌐 서버 기반 시스템 활성화됨
            </p>
            <p className="text-[10px] text-green-500">
              모든 데이터는 Supabase에 안전하게 보관됩니다
            </p>
          </div>
          
          {/* 서버 연결 테스트 버튼 */}
          <div className="mt-2 text-center">
            <button
              onClick={checkServerConnection}
              disabled={isLoggingIn}
              className="text-xs text-blue-400 hover:text-blue-600 underline transition-colors duration-200"
            >
              {isLoggingIn ? '처리 중...' : '서버 연결 테스트'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogInPage;
