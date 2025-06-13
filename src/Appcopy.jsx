// Appcopy.jsx - 모든 문제 해결 완료 버전
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

  // ✨ 완전히 수정된 getAllUsers 함수
  const getAllUsers = () => {
    console.log('📋 모든 사용자 조회 시작');
    const users = new Set();
    
    // localStorage의 모든 키를 확인
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('-')) {
        const [nickname] = key.split('-');
        // 관리자가 아닌 경우만 추가
        if (nickname && !ADMIN_USERS.includes(nickname)) {
          console.log('📋 발견된 사용자:', nickname, '키:', key);
          users.add(nickname);
        }
      }
    }
    
    const userList = Array.from(users);
    console.log('📋 최종 사용자 목록:', userList);
    return userList;
  };

  // ✨ 완전히 수정된 getUserData 함수
  const getUserData = (nickname) => {
    console.log('📦 사용자 데이터 조회:', nickname);
    
    if (!nickname) {
      console.log('❌ 사용자명이 없음');
      return {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
    }

    try {
      // loadAllUserData 함수를 사용하여 데이터 로드
      const userData = loadAllUserData(nickname);
      
      console.log('📦 로드된 데이터:', {
        nickname,
        hasSchedules: !!userData.schedules,
        schedulesCount: userData.schedules?.length || 0,
        hasTags: !!userData.tags,
        tagsCount: userData.tags?.length || 0,
        hasTagItems: !!userData.tagItems,
        tagItemsCount: userData.tagItems?.length || 0,
        hasMonthlyPlans: !!userData.monthlyPlans,
        monthlyPlansCount: userData.monthlyPlans?.length || 0,
        hasMonthlyGoals: !!userData.monthlyGoals,
        monthlyGoalsCount: userData.monthlyGoals?.length || 0
      });

      return userData;
    } catch (error) {
      console.error('❌ 사용자 데이터 로드 실패:', error);
      return {
        schedules: [],
        tags: [],
        tagItems: [],
        monthlyPlans: [],
        monthlyGoals: []
      };
    }
  };

  const getUserStats = () => {
    const users = getAllUsers();
    const stats = {};
    users.forEach(user => {
      const userData = getUserData(user);
      stats[user] = {
        schedules: userData.schedules?.length || 0,
        tags: userData.tags?.length || 0,
        tagItems: userData.tagItems?.length || 0,
        monthlyPlans: userData.monthlyPlans?.length || 0,
        monthlyGoals: userData.monthlyGoals?.length || 0,
        lastActivity: '오늘'
      };
    });
    return stats;
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

  // ✨ 완전히 수정된 사용자 데이터 로드 함수
  const loadCurrentUserData = async (nickname) => {
    if (!nickname) {
      console.log('❌ 닉네임이 없음');
      setIsLoading(false);
      setDataLoaded(true);
      return;
    }
    
    console.log('📦 데이터 로딩 시작:', nickname);
    
    // ✨ 먼저 관리자 여부를 확인
    const isUserAdmin = checkIsAdmin(nickname);
    console.log('👑 관리자 체크 결과:', { nickname, isUserAdmin });
    
    // 관리자인 경우 데이터 로딩 스킵
    if (isUserAdmin) {
      console.log('👑 관리자 로그인 - 데이터 로딩 스킵');
      
      // ✨ 관리자 상태 한 번에 설정 (동기화) - 빈 배열로 초기화
      setIsAdmin(true);
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
      setDataLoaded(true);
      setIsLoading(false);
      
      console.log('✅ 관리자 상태 설정 완료');
      return;
    }
    
    // 일반 사용자 처리
    try {
      setIsAdmin(false);
      console.log('📦 일반 사용자 데이터 로딩 시작:', nickname);
      
      let userData = await loadUserDataWithFallback(nickname);
      
      if (!userData || 
          !userData.tags || userData.tags.length === 0 ||
          !userData.tagItems || userData.tagItems.length === 0) {
        
        console.log('🆕 새 사용자 또는 빈 데이터 감지, 기본 데이터 생성 중...');
        
        userData = {
          schedules: userData?.schedules || [],
          tags: [
            { tagType: '공부', color: { bg: 'bg-blue-100', text: 'text-blue-800' } },
            { tagType: '운동', color: { bg: 'bg-green-100', text: 'text-green-800' } },
            { tagType: '취미', color: { bg: 'bg-purple-100', text: 'text-purple-800' } },
            { tagType: '업무', color: { bg: 'bg-red-100', text: 'text-red-800' } }
          ],
          tagItems: [
            { tagType: '공부', tagName: '독서' },
            { tagType: '공부', tagName: '강의 수강' },
            { tagType: '공부', tagName: '과제' },
            { tagType: '운동', tagName: '조깅' },
            { tagType: '운동', tagName: '헬스장' },
            { tagType: '취미', tagName: '음악 감상' },
            { tagType: '취미', tagName: '영화 관람' },
            { tagType: '업무', tagName: '회의' },
            { tagType: '업무', tagName: '프로젝트' }
          ],
          monthlyPlans: userData?.monthlyPlans || [],
          monthlyGoals: userData?.monthlyGoals || []
        };
      }
      
      // 상태 설정 (한 번에)
      setSchedules(userData.schedules || []);
      setTags(userData.tags || []);
      setTagItems(userData.tagItems || []);
      setMonthlyPlans(userData.monthlyPlans || []);
      setMonthlyGoals(userData.monthlyGoals || []);
      
      // 초기 데이터 해시 설정
      lastSaveDataRef.current = generateDataHash(
        userData.schedules || [],
        userData.tags || [],
        userData.tagItems || [],
        userData.monthlyPlans || [],
        userData.monthlyGoals || []
      );
      
      console.log('✅ 일반 사용자 데이터 로딩 완료:', {
        nickname,
        schedulesCount: userData.schedules?.length || 0,
        tagsCount: userData.tags?.length || 0,
        tagItemsCount: userData.tagItems?.length || 0,
        monthlyPlansCount: userData.monthlyPlans?.length || 0,
        monthlyGoalsCount: userData.monthlyGoals?.length || 0
      });
      
    } catch (error) {
      console.error('❌ 사용자 데이터 로딩 실패:', error);
      
      // 실패 시 빈 배열로 초기화
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
      
    } finally {
      // ✨ 항상 마지막에 로딩 완료 처리
      setDataLoaded(true);
      setIsLoading(false);
      console.log('✅ 데이터 로딩 프로세스 완료');
    }
  };

  // ✨ 개선된 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      console.log('🔐 로그인 상태 확인 시작');
      
      const nickname = localStorage.getItem('nickname');
      const userType = localStorage.getItem('userType');
      
      console.log('🔐 저장된 로그인 정보:', { nickname, userType });
      
      if (nickname) {
        console.log('✅ 로그인 정보 발견:', nickname);
        setIsLoggedIn(true);
        setCurrentUser(nickname);
        
        // 데이터 로딩 완료까지 대기
        await loadCurrentUserData(nickname);
      } else {
        console.log('❌ 로그인 정보 없음');
        setIsLoading(false);
        setDataLoaded(true);
      }
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

  // ✨ 완전히 수정된 로그아웃 함수
  const handleLogout = () => {
    console.log('🚪 로그아웃 시작');
    
    // 타이머 정리
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // localStorage 정리
    localStorage.removeItem('nickname');
    localStorage.removeItem('userType');
    
    // 모든 상태 즉시 초기화
    setIsLoggedIn(false);
    setCurrentUser('');
    setSchedules([]);
    setTags([]);
    setTagItems([]);
    setMonthlyPlans([]);
    setMonthlyGoals([]);
    setIsAdmin(false);
    setDataLoaded(true);  // ✨ 데이터 로딩 완료로 설정하여 무한 로딩 방지
    setIsLoading(false);  // ✨ 로딩 상태 해제
    
    // 플래그 초기화
    isSavingRef.current = false;
    lastSaveDataRef.current = '';
    
    console.log('🚪 로그아웃 완료 - 로그인 페이지로 이동');
    
    // ✨ 즉시 로그인 페이지로 이동
    setTimeout(() => {
      window.location.href = '#/login';
    }, 100);
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

  // ✨ 로딩 조건 단순화 - 로그아웃 후 무한 로딩 방지
  if (isLoading && !dataLoaded) {
    const nickname = localStorage.getItem('nickname');
    const isCurrentAdmin = checkIsAdmin(nickname);
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isCurrentAdmin ? '관리자 권한 확인 중...' : '사용자 데이터를 불러오는 중...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {nickname ? `${nickname}님의 데이터 로딩 중...` : '로그인 정보 확인 중...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LogInPage />} />
        
        {/* ✨ 완전히 개선된 루트 라우팅 */}
        <Route
          path="/"
          element={(() => {
            const nickname = localStorage.getItem('nickname');
            const userType = localStorage.getItem('userType');
            
            // 로그인 상태 확인
            if (!nickname || !isLoggedIn) {
              console.log('🏠 루트: 로그인 필요');
              return <Navigate to="/login" replace />;
            }
            
            // 관리자 여부 확인
            const isDirectAdmin = userType === 'admin' || ADMIN_USERS.includes(nickname);
            
            console.log('🏠 루트 라우팅 판단:', {
              nickname,
              userType,
              isDirectAdmin,
              isLoggedIn,
              dataLoaded
            });
            
            // 즉시 판단하여 리다이렉트
            if (isDirectAdmin) {
              console.log('🏠 → 관리자 페이지로 이동');
              return <Navigate to="/admin" replace />;
            } else {
              console.log('🏠 → 일반 사용자 캘린더로 이동');
              return <Navigate to="/calendar" replace />;
            }
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
