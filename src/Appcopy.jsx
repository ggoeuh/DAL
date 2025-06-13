// Appcopy.jsx - 라우팅 문제 해결 버전 (빌드 에러 수정)
import React, { useState, useEffect, useRef } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LogInPage from './pages/LogInPage';
import CalendarPage from './pages/CalendarPage';
import DayDetailPagecopy from './pages/DayDetailPagecopy';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMemberView from './pages/AdminMemberView';

// 기존 저장 시스템
import {
  loadAllUserData,
  saveUserCoreData,
  saveSchedulesToStorage,
  saveTagsToStorage,
  saveTagItemsToStorage,
  saveMonthlyPlansToStorage,
  saveMonthlyGoalsToStorage,
  backupToServer,
  restoreFromServer,
  loadUserDataWithFallback,
  getUserKeys,
  debugStorage
} from './pages/utils/unifiedStorage';

// ✨ Supabase DAL 기능 추가
import './pages/utils/supabaseStorage.js';

// ✨ 관리자 목록 상수 (LogInPage와 동일하게 유지)
const ADMIN_USERS = ['교수님', 'admin', '관리자'];

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  return nickname ? children : <Navigate to="/login" replace />;
};

// ✨ 수정된 관리자 전용 라우트 컴포넌트
const AdminRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  const userType = localStorage.getItem('userType');
  
  // 더블 체크: userType이 admin이거나 nickname이 관리자 목록에 있는 경우
  const isAdmin = userType === 'admin' || ADMIN_USERS.includes(nickname);
  
  console.log('🔍 AdminRoute 체크:', { nickname, userType, isAdmin });
  
  return isAdmin ? children : <Navigate to="/calendar" replace />;
};

function Appcopy() {
  // 기존 상태들
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');
  
  // ✨ 새로 추가: 관리자 여부 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 🔧 중복 저장 방지용 플래그들
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSaveDataRef = useRef('');

  // ✨ 수정된 관리자 여부 확인 함수
  const checkIsAdmin = (nickname) => {
    const userType = localStorage.getItem('userType');
    
    // userType이 admin이거나 nickname이 관리자 목록에 있는 경우
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
      mg: monthlyGoals.length
    });
  };

  // 🔧 안전한 서버 저장 (중복 실행 완전 차단)
  const safeServerSave = async () => {
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
      
      await saveUserCoreData(currentUser, {
        schedules, tags, tagItems, monthlyPlans, monthlyGoals
      });
      
      console.log('✅ 서버 저장 완료:', currentUser);
    } catch (error) {
      console.warn('⚠️ 서버 저장 실패 (로컬은 저장됨):', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  // ✨ 서버 기반 getAllUsers 함수 - 서버에서 사용자 목록 가져오기
  const getAllUsers = async () => {
    console.log('🔍 서버에서 사용자 목록 가져오기 시작');
    
    try {
      // 1단계: 서버에서 모든 사용자 데이터 확인
      const users = new Set();
      
      // localStorage에서 사용자 이름들 먼저 수집
      const localUsers = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('-')) {
          const [nickname] = key.split('-');
          if (nickname && 
              nickname !== 'nickname' && 
              nickname !== 'userType' &&
              !ADMIN_USERS.includes(nickname)) {
            localUsers.push(nickname);
          }
        }
      }
      
      console.log('🔍 localStorage에서 발견된 사용자들:', localUsers);
      
      // 2단계: 각 사용자의 서버 데이터 확인
      for (const user of [...new Set(localUsers)]) {
        try {
          const userData = await loadUserDataWithFallback(user);
          if (userData && (
            (userData.schedules && userData.schedules.length > 0) ||
            (userData.tags && userData.tags.length > 0) ||
            (userData.tagItems && userData.tagItems.length > 0)
          )) {
            users.add(user);
            console.log(`✅ 서버에서 ${user} 데이터 확인됨`);
          }
        } catch (error) {
          console.error(`❌ ${user} 서버 데이터 확인 실패:`, error);
        }
      }
      
      const result = Array.from(users);
      console.log('🔍 서버 기반 최종 사용자 목록:', result);
      return result;
      
    } catch (error) {
      console.error('❌ 서버에서 사용자 목록 가져오기 실패:', error);
      
      // 서버 실패 시 localStorage fallback
      const fallbackUsers = new Set();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('-')) {
          const [nickname] = key.split('-');
          if (nickname && 
              nickname !== 'nickname' && 
              nickname !== 'userType' &&
              !ADMIN_USERS.includes(nickname)) {
            fallbackUsers.add(nickname);
          }
        }
      }
      
      const fallbackResult = Array.from(fallbackUsers);
      console.log('🔄 fallback 사용자 목록:', fallbackResult);
      return fallbackResult;
    }
  };

  // ✨ 수정된 getUserData 함수 - 서버 데이터 우선
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
    try {
      const userData = await loadUserDataWithFallback(nickname);
      console.log('📦 서버에서 로드된 데이터:', {
        nickname,
        schedules: userData?.schedules?.length || 0,
        tags: userData?.tags?.length || 0,
        tagItems: userData?.tagItems?.length || 0,
        monthlyPlans: userData?.monthlyPlans?.length || 0,
        monthlyGoals: userData?.monthlyGoals?.length || 0
      });
      
      return userData;
    } catch (error) {
      console.error(`❌ ${nickname} 서버 데이터 로드 실패:`, error);
      
      // fallback to localStorage
      return loadAllUserData(nickname);
    }
  };

  const getUserStats = async () => {
    console.log('📊 서버 기반 getUserStats 실행 시작');
    
    try {
      // getAllUsers가 이제 async이므로 await 사용
      const users = await getAllUsers();
      console.log('📊 서버에서 가져온 사용자 목록:', users);
      
      const stats = {};
      
      for (const user of users) {
        console.log(`📊 ${user} 서버 데이터 통계 계산 중...`);
        try {
          const userData = await getUserData(user);
          
          if (userData) {
            stats[user] = {
              schedules: userData.schedules?.length || 0,
              tags: userData.tags?.length || 0,
              tagItems: userData.tagItems?.length || 0,
              monthlyPlans: userData.monthlyPlans?.length || 0,
              monthlyGoals: userData.monthlyGoals?.length || 0,
              lastActivity: '오늘'
            };
            console.log(`📊 ${user} 서버 기반 통계:`, stats[user]);
          } else {
            console.warn(`⚠️ ${user} 서버 데이터 없음`);
          }
        } catch (error) {
          console.error(`❌ ${user} 통계 계산 실패:`, error);
        }
      }
      
      console.log('📊 서버 기반 getUserStats 최종 결과:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ 서버 기반 getUserStats 실패:', error);
      return {};
    }
  };

  // 수동 동기화
  const handleManualServerSync = async (showConfirm = true) => {
    if (!currentUser || isAdmin) return false;

    if (showConfirm && !window.confirm('수동으로 서버와 동기화하시겠습니까?')) {
      return false;
    }

    try {
      console.log('🔧 수동 서버 동기화 시작:', currentUser);
      await safeServerSave();
      alert('✅ 서버 동기화가 완료되었습니다!');
      return true;
    } catch (error) {
      console.error('❌ 수동 서버 동기화 실패:', error);
      alert('❌ 서버 동기화 실패');
      return false;
    }
  };

  // ✨ 개선된 사용자 데이터 로드 함수 - 완전한 비동기 처리
  const loadCurrentUserData = async (nickname) => {
    if (!nickname) return;
    
    console.log('📦 데이터 로딩 시작:', nickname);
    
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
    console.log('📦 일반 사용자 데이터 로딩 시작:', nickname);
    
    try {
      // ✨ 더 강력한 데이터 로딩 - 서버 우선
      let userData = null;
      
      // 1차: 서버에서 로딩 시도
      userData = await loadUserDataWithFallback(nickname);
      
      // 2차: 직접 localStorage에서 로딩 시도
      if (!userData || !userData.schedules) {
        console.log('🔄 대체 로딩 방법 시도...');
        userData = loadAllUserData(nickname);
      }
      
      // 3차: 기본 구조라도 생성
      if (!userData || 
          !userData.tags || userData.tags.length === 0 || 
          !userData.tagItems || userData.tagItems.length === 0) {
        
        console.log('🆕 기본 데이터 구조 생성:', nickname);
        
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
        
        userData = {
          schedules: userData?.schedules || [],
          tags: userData?.tags?.length > 0 ? userData.tags : defaultTags,
          tagItems: userData?.tagItems?.length > 0 ? userData.tagItems : defaultTagItems,
          monthlyPlans: userData?.monthlyPlans || [],
          monthlyGoals: userData?.monthlyGoals || []
        };
        
        // 기본 데이터 저장
        if (userData.tags.length > 0 && userData.tagItems.length > 0) {
          saveTagsToStorage(nickname, userData.tags);
          saveTagItemsToStorage(nickname, userData.tagItems);
          console.log('💾 기본 데이터 저장 완료');
        }
      }
      
      // ✨ 상태 업데이트를 한 번에 처리 (리렌더링 최소화)
      const newSchedules = userData.schedules || [];
      const newTags = userData.tags || [];
      const newTagItems = userData.tagItems || [];
      const newMonthlyPlans = userData.monthlyPlans || [];
      const newMonthlyGoals = userData.monthlyGoals || [];
      
      // 상태 업데이트
      setSchedules(newSchedules);
      setTags(newTags);
      setTagItems(newTagItems);
      setMonthlyPlans(newMonthlyPlans);
      setMonthlyGoals(newMonthlyGoals);
      
      // 초기 데이터 해시 설정
      lastSaveDataRef.current = generateDataHash(
        newSchedules,
        newTags,
        newTagItems,
        newMonthlyPlans,
        newMonthlyGoals
      );
      
      console.log('✅ 데이터 로딩 완료:', {
        nickname,
        schedulesCount: newSchedules.length,
        tagsCount: newTags.length,
        tagItemsCount: newTagItems.length,
        monthlyPlansCount: newMonthlyPlans.length,
        monthlyGoalsCount: newMonthlyGoals.length
      });
      
    } catch (error) {
      console.error('❌ 데이터 로딩 실패:', error);
      
      // 실패 시 빈 상태로 초기화
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
    }
    
    // ✨ 로딩 완료 상태 설정
    setDataLoaded(true);
  };

  // ✨ 개선된 로그인 상태 확인 - 완전한 비동기 처리
  useEffect(() => {
    const checkLoginStatus = async () => {
      console.log('🔐 로그인 상태 확인 시작');
      
      const nickname = localStorage.getItem('nickname');
      const userType = localStorage.getItem('userType');
      
      console.log('🔐 저장된 로그인 정보:', { nickname, userType });
      
      if (nickname) {
        setIsLoggedIn(true);
        setCurrentUser(nickname);
        
        // ✨ 데이터 로딩을 완전히 완료한 후에만 다음 단계로
        await loadCurrentUserData(nickname);
        console.log('✅ 모든 초기화 완료');
      } else {
        console.log('❌ 로그인 정보 없음');
        setIsLoading(false);
        setDataLoaded(true);
      }
      
      // ✨ 마지막에 로딩 상태 해제
      setIsLoading(false);
    };
    
    checkLoginStatus();
  }, []);

  // 🔧 일반 사용자만 자동 저장 (1초 디바운싱)
  useEffect(() => {
    if (!currentUser || isLoading || isAdmin || !dataLoaded) return;

    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 1초 디바운싱
    saveTimeoutRef.current = setTimeout(() => {
      safeServerSave();
    }, 1000);

    // 클린업
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading, isAdmin, dataLoaded]);

  // 🔧 상태 업데이트 함수들 (관리자는 저장 안 함)
  const updateSchedules = (newSchedules) => {
    setSchedules(newSchedules);
    // 일반 사용자만 로컬 저장
    if (currentUser && !isAdmin) {
      saveSchedulesToStorage(currentUser, newSchedules);
      console.log('💾 일정 즉시 로컬 저장:', newSchedules.length, '개');
    }
  };

  const updateTags = (newTags) => {
    setTags(newTags);
    if (currentUser && !isAdmin) {
      saveTagsToStorage(currentUser, newTags);
      console.log('💾 태그 즉시 로컬 저장:', newTags.length, '개');
    }
  };

  const updateTagItems = (newTagItems) => {
    setTagItems(newTagItems);
    if (currentUser && !isAdmin) {
      saveTagItemsToStorage(currentUser, newTagItems);
      console.log('💾 태그아이템 즉시 로컬 저장:', newTagItems.length, '개');
    }
  };

  const updateMonthlyPlans = (newPlans) => {
    setMonthlyPlans(newPlans);
    if (currentUser && !isAdmin) {
      saveMonthlyPlansToStorage(currentUser, newPlans);
      console.log('💾 월간계획 즉시 로컬 저장:', newPlans.length, '개');
    }
  };

  const updateMonthlyGoals = (newGoals) => {
    setMonthlyGoals(newGoals);
    if (currentUser && !isAdmin) {
      saveMonthlyGoalsToStorage(currentUser, newGoals);
      console.log('💾 월간목표 즉시 로컬 저장:', newGoals.length, '개');
    }
  };

  // ✨ 수정된 로그아웃 함수
  const handleLogout = () => {
    console.log('🚪 로그아웃 시작');
    
    // 타이머 정리
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // localStorage 정리 (데이터는 보존, 로그인 정보만 삭제)
    localStorage.removeItem('nickname');
    localStorage.removeItem('userType');
    
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
    
    // 플래그 초기화
    isSavingRef.current = false;
    lastSaveDataRef.current = '';
    
    console.log('🚪 로그아웃 완료 - 로그인 페이지로 이동');
    
    // 강제 페이지 이동
    window.location.href = '#/login';
  };

  const handleAdminLogout = () => {
    console.log('👑 관리자 로그아웃');
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

  // ✨ 개선된 로딩 화면
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {currentUser ? 
              (checkIsAdmin(currentUser) ? '관리자 권한 확인 중...' : `${currentUser}님의 데이터를 불러오는 중...`) : 
              '로그인 정보 확인 중...'
            }
          </p>
          <div className="mt-2 text-xs text-gray-500">
            {currentUser && !checkIsAdmin(currentUser) && (
              <div className="space-y-1">
                <div>📅 일정 데이터 로딩...</div>
                <div>🏷️ 태그 설정 확인...</div>
                <div>📊 월간 계획 불러오기...</div>
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
        
        {/* ✨ 개선된 루트 라우팅 */}
        <Route
          path="/"
          element={(() => {
            if (!isLoggedIn || !dataLoaded) {
              return <Navigate to="/login" replace />;
            }
            
            // localStorage에서 직접 체크
            const nickname = localStorage.getItem('nickname');
            const userType = localStorage.getItem('userType');
            const isDirectAdmin = userType === 'admin' || ADMIN_USERS.includes(nickname);
            
            console.log('🏠 루트 라우팅:', {
              nickname,
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
                getAllUsers={getAllUsers}
                getUserStats={getUserStats}
                getUserData={getUserData}
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
              />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default Appcopy;
