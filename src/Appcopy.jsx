// Appcopy.jsx - 완전 서버 기반 버전
import React, { useState, useEffect, useRef } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LogInPage from './pages/LogInPage';
import CalendarPage from './pages/CalendarPage';
import DayDetailPagecopy from './pages/DayDetailPagecopy';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMemberView from './pages/AdminMemberView';

// ✨ Supabase 전용 import (로컬 저장소 시스템 제거)
import { saveUserDataToDAL, loadUserDataFromDAL, supabase } from './pages/utils/supabaseStorage.js';

// ✨ 관리자 목록 상수 (LogInPage와 동일하게 유지)
const ADMIN_USERS = ['교수님', 'admin', '관리자'];

// 보호된 라우트 컴포넌트 (세션 기반)
const ProtectedRoute = ({ children }) => {
  const currentUser = sessionStorage.getItem('currentUser');
  return currentUser ? children : <Navigate to="/login" replace />;
};

// ✨ 수정된 관리자 전용 라우트 컴포넌트 (세션 기반)
const AdminRoute = ({ children }) => {
  const currentUser = sessionStorage.getItem('currentUser');
  const userType = sessionStorage.getItem('userType');
  
  // 더블 체크: userType이 admin이거나 nickname이 관리자 목록에 있는 경우
  const isAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
  
  console.log('🔍 AdminRoute 체크:', { currentUser, userType, isAdmin });
  
  return isAdmin ? children : <Navigate to="/calendar" replace />;
};

function Appcopy() {
  // ✨ 서버 기반 상태 관리
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // 🔧 서버 저장 상태 관리
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSaveDataRef = useRef('');

  // ✨ 수정된 관리자 여부 확인 함수 (세션 기반)
  const checkIsAdmin = (nickname) => {
    const userType = sessionStorage.getItem('userType');
    
    const isAdminByType = userType === 'admin';
    const isAdminByName = ADMIN_USERS.includes(nickname);
    
    console.log('🔍 관리자 체크:', {
      nickname,
      userType,
      isAdminByType,
      isAdminByName,
      ADMIN_USERS,
      result: isAdminByType || isAdminByName
    });
    
    return isAdminByType || isAdminByName;
  };

  // 🔧 데이터 해시 생성 (변경 감지용)
  const generateDataHash = (schedules, tags, tagItems, monthlyPlans, monthlyGoals) => {
    return JSON.stringify({
      s: schedules.length,
      t: tags.length, 
      ti: tagItems.length,
      mp: monthlyPlans.length,
      mg: monthlyGoals.length,
      timestamp: Date.now()
    });
  };

  // ✨ 서버에서 사용자 데이터 로드
  const loadUserDataFromServer = async (nickname) => {
    if (!nickname || !supabase) return null;

    try {
      console.log('🌐 서버에서 사용자 데이터 로드:', nickname);

      const result = await loadUserDataFromDAL(nickname);
      
      if (result.success && result.data) {
        console.log('✅ 서버 데이터 로드 성공:', {
          schedules: result.data.schedules?.length || 0,
          tags: result.data.tags?.length || 0,
          tagItems: result.data.tagItems?.length || 0,
          monthlyPlans: result.data.monthlyPlans?.length || 0,
          monthlyGoals: result.data.monthlyGoals?.length || 0
        });

        return result.data;
      } else {
        console.warn('⚠️ 서버에 데이터 없음:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ 서버 데이터 로드 실패:', error);
      return null;
    }
  };

  // ✨ 서버에 사용자 데이터 저장
  const saveUserDataToServer = async () => {
    if (!currentUser || isLoading || isSavingRef.current || isAdmin) return;

    // 관리자는 데이터 저장 안 함
    if (checkIsAdmin(currentUser)) {
      console.log('⚠️ 관리자는 데이터 저장하지 않음');
      return;
    }

    // 데이터 변경 여부 확인
    const currentDataHash = generateDataHash(schedules, tags, tagItems, monthlyPlans, monthlyGoals);
    if (currentDataHash === lastSaveDataRef.current) {
      console.log('⚠️ 데이터 변경 없음 - 서버 저장 스킵');
      return;
    }

    isSavingRef.current = true;
    lastSaveDataRef.current = currentDataHash;

    try {
      console.log('🌐 서버 저장 시작:', currentUser);
      
      const dataToSave = {
        schedules,
        tags,
        tagItems,
        monthlyPlans,
        monthlyGoals
      };

      const result = await saveUserDataToDAL(currentUser, dataToSave);
      
      if (result.success) {
        console.log('✅ 서버 저장 완료:', currentUser);
        setLastSyncTime(new Date());
      } else {
        throw new Error(result.error || '서버 저장 실패');
      }
    } catch (error) {
      console.warn('⚠️ 서버 저장 실패:', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  // ✨ 서버에서 모든 사용자 목록 가져오기
  const getAllUsersFromServer = async () => {
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
        !ADMIN_USERS.includes(userName)
      );

      console.log('✅ 서버에서 발견된 사용자들:', uniqueUsers);
      return uniqueUsers;

    } catch (error) {
      console.error('❌ 서버 사용자 검색 실패:', error);
      return [];
    }
  };

  // ✨ 서버 기반 사용자 데이터 조회
  const getUserData = async (nickname) => {
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

    console.log('📦 getUserData 서버 호출:', nickname);
    
    const userData = await loadUserDataFromServer(nickname);
    
    if (userData) {
      return userData;
    } else {
      // 빈 데이터 구조 반환
      return {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
    }
  };

  // ✨ 서버 기반 사용자 통계
  const getUserStats = async () => {
    console.log('📊 서버 기반 getUserStats 실행 시작');
    
    try {
      const users = await getAllUsersFromServer();
      console.log('📊 서버에서 가져온 사용자 목록:', users);
      
      const stats = {};
      
      for (const user of users) {
        console.log(📊 ${user} 서버 데이터 통계 계산 중...);
        try {
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
            console.log(📊 ${user} 서버 기반 통계:, stats[user]);
          }
        } catch (error) {
          console.error(❌ ${user} 통계 계산 실패:, error);
        }
      }
      
      console.log('📊 서버 기반 getUserStats 최종 결과:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ 서버 기반 getUserStats 실패:', error);
      return {};
    }
  };

  // ✨ 개선된 사용자 데이터 로드 함수 (서버 기반)
  const loadCurrentUserData = async (nickname) => {
    if (!nickname) return;
    
    console.log('📦 서버 기반 데이터 로딩 시작:', nickname);
    
    // 먼저 관리자 여부를 확인
    const isUserAdmin = checkIsAdmin(nickname);
    console.log('👑 관리자 체크 결과:', { nickname, isUserAdmin });
    
    // 관리자인 경우
    if (isUserAdmin) {
      console.log('👑 관리자 로그인 - 데이터 로딩 스킵');
      setIsAdmin(true);
      setDataLoaded(true);
      return;
    }
    
    // 일반 사용자 데이터 로딩
    setIsAdmin(false);
    console.log('📦 일반 사용자 서버 데이터 로딩 시작:', nickname);
    
    try {
      // 서버에서 데이터 로드
      const userData = await loadUserDataFromServer(nickname);
      
      if (userData) {
        // 서버 데이터가 있는 경우
        setSchedules(userData.schedules || []);
        setTags(userData.tags || []);
        setTagItems(userData.tagItems || []);
        setMonthlyPlans(userData.monthlyPlans || []);
        setMonthlyGoals(userData.monthlyGoals || []);
        
        console.log('✅ 서버 데이터 로딩 완료:', {
          nickname,
          schedulesCount: userData.schedules?.length || 0,
          tagsCount: userData.tags?.length || 0,
          tagItemsCount: userData.tagItems?.length || 0,
          monthlyPlansCount: userData.monthlyPlans?.length || 0,
          monthlyGoalsCount: userData.monthlyGoals?.length || 0
        });
      } else {
        // 서버에 데이터가 없는 경우 - 신규 사용자
        console.log('🆕 신규 사용자 - 기본 데이터 구조 생성:', nickname);
        
        const defaultTags = [
          { tagType: '공부', color: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' } },
          { tagType: '운동', color: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' } },
          { tagType: '취미', color: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' } },
          { tagType: '업무', color: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' } }
        ];
        
        const defaultTagItems = [
          { tagType: '공부', tagName: '독서' },
          { tagType: '공부', tagName: '강의 수강' },
          { tagType: '공부', tagName: '과제' },
          { tagType: '운동', tagName: '조깅' },
          { tagType: '운동', tagName: '헬스장' },
          { tagType: '취미', tagName: '음악 감상' },
          { tagType: '취미', tagName: '영화 관람' },
          { tagType: '업무', tagName: '회의' },
          { tagType: '업무', tagName: '프로젝트' }
        ];
        
        // 신규 사용자 기본 데이터 설정
        setSchedules([]);
        setTags(defaultTags);
        setTagItems(defaultTagItems);
        setMonthlyPlans([]);
        setMonthlyGoals([]);
        
        // 기본 데이터를 서버에 저장
        const initialData = {
          schedules: [],
          tags: defaultTags,
          tagItems: defaultTagItems,
          monthlyPlans: [],
          monthlyGoals: []
        };
        
        const saveResult = await saveUserDataToDAL(nickname, initialData);
        if (saveResult.success) {
          console.log('💾 신규 사용자 기본 데이터 서버 저장 완료');
        }
      }
      
      // 초기 데이터 해시 설정
      lastSaveDataRef.current = generateDataHash(
        schedules,
        tags,
        tagItems,
        monthlyPlans,
        monthlyGoals
      );
      
      setLastSyncTime(new Date());
      
    } catch (error) {
      console.error('❌ 서버 데이터 로딩 실패:', error);
      
      // 실패 시 빈 상태로 초기화
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
    }
    
    setDataLoaded(true);
  };

  // ✨ 개선된 로그인 상태 확인 (세션 기반)
  useEffect(() => {
    const checkLoginStatus = async () => {
      console.log('🔐 로그인 상태 확인 시작 (세션 기반)');
      
      const currentUser = sessionStorage.getItem('currentUser');
      const userType = sessionStorage.getItem('userType');
      
      console.log('🔐 저장된 세션 정보:', { currentUser, userType });
      
      if (currentUser) {
        setIsLoggedIn(true);
        setCurrentUser(currentUser);
        
        // 데이터 로딩을 완전히 완료한 후에만 다음 단계로
        await loadCurrentUserData(currentUser);
        console.log('✅ 서버 기반 모든 초기화 완료');
      } else {
        console.log('❌ 세션 정보 없음');
        setIsLoading(false);
        setDataLoaded(true);
      }
      
      setIsLoading(false);
    };
    
    checkLoginStatus();
  }, []);

  // 🔧 일반 사용자만 자동 서버 저장 (3초 디바운싱)
  useEffect(() => {
    if (!currentUser || isLoading || isAdmin || !dataLoaded) return;

    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 3초 디바운싱 (서버 부하 고려)
    saveTimeoutRef.current = setTimeout(() => {
      saveUserDataToServer();
    }, 3000);

    // 클린업
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading, isAdmin, dataLoaded]);

  // 🔧 상태 업데이트 함수들 (서버 기반)
  const updateSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    console.log('📅 일정 상태 업데이트:', newSchedules.length, '개');
  };

  const updateTags = (newTags) => {
    setTags(newTags);
    console.log('🏷️ 태그 상태 업데이트:', newTags.length, '개');
  };

  const updateTagItems = (newTagItems) => {
    setTagItems(newTagItems);
    console.log('📋 태그아이템 상태 업데이트:', newTagItems.length, '개');
  };

  const updateMonthlyPlans = (newPlans) => {
    setMonthlyPlans(newPlans);
    console.log('📊 월간계획 상태 업데이트:', newPlans.length, '개');
  };

  const updateMonthlyGoals = (newGoals) => {
    setMonthlyGoals(newGoals);
    console.log('🎯 월간목표 상태 업데이트:', newGoals.length, '개');
  };

  // ✨ 수정된 로그아웃 함수 (세션 기반)
  const handleLogout = () => {
    console.log('🚪 로그아웃 시작 (세션 기반)');
    
    // 타이머 정리
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 세션 정리 (서버 데이터는 보존)
    sessionStorage.clear();
    
    // 상태 초기화
    setIsLoggedIn(false);
    setCurrentUser('');
    setSchedules([]);
    setTags([]);
    setTagItems([]);
    setMonthlyPlans([]);
    setMonthlyGoals([]);
    setIsAdmin(false);
    setDataLoaded(false);
    setIsLoading(false);
    setLastSyncTime(null);
    
    // 플래그 초기화
    isSavingRef.current = false;
    lastSaveDataRef.current = '';
    
    console.log('🚪 로그아웃 완료 - 로그인 페이지로 이동');
    
    // 강제 페이지 이동
    window.location.href = '#/login';
  };

  const handleAdminLogout = () => {
    console.log('👑 관리자 로그아웃 (세션 기반)');
    handleLogout();
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ✨ 개선된 로딩 화면 (서버 기반)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {currentUser ? 
              (checkIsAdmin(currentUser) ? '관리자 권한 확인 중...' : ${currentUser}님의 서버 데이터를 불러오는 중...) : 
              '로그인 정보 확인 중...'
            }
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {currentUser && !checkIsAdmin(currentUser) && (
              <div className="space-y-1">
                <div>🌐 Supabase 서버 연결 중...</div>
                <div>📅 일정 데이터 로딩...</div>
                <div>🏷️ 태그 설정 확인...</div>
                <div>📊 월간 계획 불러오기...</div>
              </div>
            )}
            {lastSyncTime && (
              <div className="text-green-600 mt-2">
                마지막 동기화: {lastSyncTime.toLocaleTimeString('ko-KR')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LogInPage />} />
        
        {/* ✨ 개선된 루트 라우팅 (세션 기반) */}
        <Route
          path="/"
          element={(() => {
            if (!isLoggedIn || !dataLoaded) {
              return <Navigate to="/login" replace />;
            }
            
            // 세션에서 직접 체크
            const currentUser = sessionStorage.getItem('currentUser');
            const userType = sessionStorage.getItem('userType');
            const isDirectAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
            
            console.log('🏠 루트 라우팅 (세션 기반):', {
              currentUser,
              userType,
              isDirectAdmin,
              targetRoute: isDirectAdmin ? '/admin' : '/calendar'
            });
            
            return isDirectAdmin ? 
              <Navigate to="/admin" replace /> : 
              <Navigate to="/calendar" replace />;
          })()}
        />

        <Route
          path="/admin/member/:memberName"
          element={
            <AdminRoute>
              <AdminMemberView
                currentUser={currentUser}
                onLogout={handleAdminLogout}
                getUserData={getUserData}
              />
            </AdminRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard
                currentUser={currentUser}
                onLogout={handleAdminLogout}
                getAllUsers={getAllUsersFromServer}
                getUserData={getUserData}
                getUserStats={getUserStats}
              />
            </AdminRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage
                schedules={schedules}
                setSchedules={updateSchedules}
                tags={tags}
                setTags={updateTags}
                tagItems={tagItems}
                setTagItems={updateTagItems}
                currentUser={currentUser}
                onLogout={handleLogout}
                lastSyncTime={lastSyncTime}
                isServerBased={true}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/day/:date"
          element={
            <ProtectedRoute>
              <DayDetailPagecopy
                schedules={schedules}
                setSchedules={updateSchedules}
                tags={tags}
                setTags={updateTags}
                tagItems={tagItems}
                setTagItems={updateTagItems}
                currentUser={currentUser}
                onLogout={handleLogout}
                lastSyncTime={lastSyncTime}
                isServerBased={true}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/monthly-plan"
          element={
            <ProtectedRoute>
              <MonthlyPlanPage
                schedules={schedules}
                setSchedules={updateSchedules}
                tags={tags}
                setTags={updateTags}
                tagItems={tagItems}
                setTagItems={updateTagItems}
                monthlyPlans={monthlyPlans}
                setMonthlyPlans={updateMonthlyPlans}
                monthlyGoals={monthlyGoals}
                setMonthlyGoals={updateMonthlyGoals}
                currentUser={currentUser}
                onLogout={handleLogout}
                lastSyncTime={lastSyncTime}
                isServerBased={true}
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default Appcopy;



이거랑 아래 코드 조합일때는 무한 로딩 없었어.

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  saveUserDataToDAL, 
  loadUserDataFromDAL,
  supabase
} from './utils/supabaseStorage.js';

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

// 시간을 분으로 변환하는 함수
const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

// 분을 시간 형식으로 변환하는 함수
const minutesToTimeString = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")};
};

// 서버 데이터 리셋 버튼 컴포넌트
const ServerDataResetButton = ({ currentUser, onDataChanged, className = "" }) => {
  const [showModal, setShowModal] = useState(false);
  const [resetType, setResetType] = useState('user');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!supabase || !currentUser) {
      alert('❌ Supabase 연결 또는 사용자 정보가 없습니다.');
      return;
    }

    setIsResetting(true);
    
    try {
      if (resetType === 'user') {
        if (window.confirm(
          ⚠️ ${currentUser} 사용자의 모든 서버 데이터를 삭제하시겠습니까?\n +
          - 모든 일정\n +
          - 모든 월간 목표\n\n +
          이 작업은 되돌릴 수 없습니다.
        )) {
          const { error } = await supabase
            .from('DAL')
            .delete()
            .eq('user_name', currentUser);
          
          if (error) {
            throw error;
          }
          
          alert(✅ ${currentUser} 사용자의 모든 서버 데이터가 삭제되었습니다.);
          if (onDataChanged) onDataChanged();
        }
      } else if (resetType === 'all') {
        if (window.confirm(
          '⚠️ 모든 사용자의 서버 데이터를 삭제하시겠습니까?\n' +
          '이 작업은 되돌릴 수 없습니다.'
        )) {
          const { error } = await supabase
            .from('DAL')
            .delete()
            .neq('id', 0); // 모든 레코드 삭제
          
          if (error) {
            throw error;
          }
          
          alert('✅ 모든 서버 데이터가 삭제되었습니다.');
          if (onDataChanged) onDataChanged();
        }
      }
    } catch (error) {
      console.error('서버 데이터 삭제 실패:', error);
      alert('❌ 서버 데이터 삭제 실패: ' + error.message);
    }
    
    setIsResetting(false);
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${className}}
        title="서버 데이터 삭제"
      >
        🗑️ 서버 삭제
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-red-600">⚠️ 서버 데이터 삭제</h3>
            
            <div className="mb-4">
              <p className="text-gray-600 mb-3">삭제할 범위를 선택해주세요:</p>
              
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="resetType"
                    value="user"
                    checked={resetType === 'user'}
                    onChange={(e) => setResetType(e.target.value)}
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium">내 모든 서버 데이터 삭제</div>
                    <div className="text-sm text-gray-500">
                      {currentUser} 사용자의 모든 일정과 월간목표 삭제
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="resetType"
                    value="all"
                    checked={resetType === 'all'}
                    onChange={(e) => setResetType(e.target.value)}
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium text-red-600">모든 서버 데이터 삭제</div>
                    <div className="text-sm text-red-500">
                      모든 사용자의 서버 데이터 삭제 (복구 불가능)
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-yellow-800 text-sm">
                <strong>주의:</strong> 서버 데이터는 한번 삭제되면 복구할 수 없습니다.
                신중하게 선택하세요.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={isResetting}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isResetting ? '삭제 중...' : '삭제 실행'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
