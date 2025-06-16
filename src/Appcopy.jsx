// Appcopy.jsx - 완전 서버 기반 버전 + 무한동기화 해결 (기존 구조 유지)
import React, { useState, useEffect, useRef, useCallback } from "react";
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

  // 🔧 서버 저장 상태 관리 (무한동기화 방지 강화)
  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSaveDataRef = useRef('');
  const prevDataRef = useRef({}); // ✅ 이전 데이터 상태 저장

  // ✨ 수정된 관리자 여부 확인 함수 (세션 기반)
  const checkIsAdmin = useCallback((nickname) => {
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
  }, []);

  // ✅ 데이터 깊은 비교 함수
  // ✅ 깊은 비교 함수
  const deepCompare = useCallback((a, b) => JSON.stringify(a) === JSON.stringify(b), []);

  const saveUserDataToServer = useCallback(async () => {
    if (!currentUser || isLoading || isAdmin) return;

    const currentData = {
      schedules,
      tags,
      tagItems,
      monthlyPlans,
      monthlyGoals,
    };

    if (deepCompare(currentData, prevDataRef.current)) {
      console.log("⚠️ 변화 없음 - 저장 스킵");
      return;
    }

    isSavingRef.current = true;
    try {
      const result = await saveUserDataToDAL(currentUser, currentData);
      if (result.success) {
        console.log("✅ 서버 저장 성공");
        prevDataRef.current = currentData;
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      console.error("❌ 저장 실패", e);
    } finally {
      isSavingRef.current = false;
    }
  }, [currentUser, isLoading, isAdmin, schedules, tags, tagItems, monthlyPlans, monthlyGoals, deepCompare]);

  useEffect(() => {
    if (!currentUser || isLoading || isAdmin || !dataLoaded) return;

    const currentData = { schedules, tags, tagItems, monthlyPlans, monthlyGoals };

    if (!deepCompare(currentData, prevDataRef.current)) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(() => {
        saveUserDataToServer();
      }, 3000);
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading, isAdmin, dataLoaded, deepCompare, saveUserDataToServer]);

  // ✅ 상태 업데이트 함수들을 useCallback으로 최적화
  const updateSchedules = useCallback((newSchedules) => {
    setSchedules(newSchedules);
    console.log('📅 일정 상태 업데이트:', newSchedules?.length || 0, '개');
  }, []);

  const updateTags = useCallback((newTags) => {
    setTags(newTags);
    console.log('🏷️ 태그 상태 업데이트:', newTags?.length || 0, '개');
  }, []);

  const updateTagItems = useCallback((newTagItems) => {
    setTagItems(newTagItems);
    console.log('📋 태그아이템 상태 업데이트:', newTagItems?.length || 0, '개');
  }, []);

  const updateMonthlyPlans = useCallback((newPlans) => {
    setMonthlyPlans(newPlans);
    console.log('📊 월간계획 상태 업데이트:', newPlans?.length || 0, '개');
  }, []);

  const updateMonthlyGoals = useCallback((newGoals) => {
    setMonthlyGoals(newGoals);
    console.log('🎯 월간목표 상태 업데이트:', newGoals?.length || 0, '개');
  }, []);

  // ✨ 수정된 로그아웃 함수 (세션 기반)
  const handleLogout = useCallback(() => {
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
    prevDataRef.current = {};
    
    console.log('🚪 로그아웃 완료 - 로그인 페이지로 이동');
    
    // 강제 페이지 이동
    window.location.href = '#/login';
  }, []);

  const handleAdminLogout = useCallback(() => {
    console.log('👑 관리자 로그아웃 (세션 기반)');
    handleLogout();
  }, [handleLogout]);

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
              (checkIsAdmin(currentUser) ? '관리자 권한 확인 중...' : `${currentUser}님의 서버 데이터를 불러오는 중...`) : 
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

        {/* ✅ 기존 구조 유지: App.jsx에서 props로 데이터 전달 */}
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
