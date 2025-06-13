// Appcopy.jsx - 응급 수정 버전 (기본 기능 복구 우선)
import React, { useState, useEffect, useRef } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LogInPage from './pages/LogInPage';
import CalendarPage from './pages/CalendarPage';
import DayDetailPagecopy from './pages/DayDetailPagecopy';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMemberView from './pages/AdminMemberView';

// 기존 저장 시스템만 사용 (Supabase는 일단 제외)
import {
  loadAllUserData,
  saveUserCoreData,
  saveSchedulesToStorage,
  saveTagsToStorage,
  saveTagItemsToStorage,
  saveMonthlyPlansToStorage,
  saveMonthlyGoalsToStorage,
  loadUserDataWithFallback
} from './pages/utils/unifiedStorage';

// 관리자 목록
const ADMIN_USERS = ['교수님', 'admin', '관리자'];

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  return nickname ? children : <Navigate to="/login" replace />;
};

// 관리자 전용 라우트 컴포넌트
const AdminRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  const userType = localStorage.getItem('userType');
  const isAdmin = userType === 'admin' || ADMIN_USERS.includes(nickname);
  return isAdmin ? children : <Navigate to="/calendar" replace />;
};

function Appcopy() {
  // 기본 상태들
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

  // 관리자 여부 확인
  const checkIsAdmin = (nickname) => {
    const userType = localStorage.getItem('userType');
    return userType === 'admin' || ADMIN_USERS.includes(nickname);
  };

  // ✅ 단순화된 상태 업데이트 함수들 (즉시 저장)
  const updateSchedules = (newSchedules) => {
    console.log('📅 일정 업데이트:', newSchedules.length, '개');
    setSchedules(newSchedules);
    
    // 즉시 로컬 저장 (관리자가 아닌 경우만)
    if (currentUser && !checkIsAdmin(currentUser)) {
      try {
        saveSchedulesToStorage(currentUser, newSchedules);
        console.log('✅ 일정 로컬 저장 성공:', newSchedules.length, '개');
      } catch (error) {
        console.error('❌ 일정 저장 실패:', error);
      }
    }
  };

  const updateTags = (newTags) => {
    console.log('🏷️ 태그 업데이트:', newTags.length, '개');
    setTags(newTags);
    
    if (currentUser && !checkIsAdmin(currentUser)) {
      try {
        saveTagsToStorage(currentUser, newTags);
        console.log('✅ 태그 로컬 저장 성공');
      } catch (error) {
        console.error('❌ 태그 저장 실패:', error);
      }
    }
  };

  const updateTagItems = (newTagItems) => {
    console.log('🔖 태그아이템 업데이트:', newTagItems.length, '개');
    setTagItems(newTagItems);
    
    if (currentUser && !checkIsAdmin(currentUser)) {
      try {
        saveTagItemsToStorage(currentUser, newTagItems);
        console.log('✅ 태그아이템 로컬 저장 성공');
      } catch (error) {
        console.error('❌ 태그아이템 저장 실패:', error);
      }
    }
  };

  const updateMonthlyPlans = (newPlans) => {
    console.log('📋 월간계획 업데이트:', newPlans.length, '개');
    setMonthlyPlans(newPlans);
    
    if (currentUser && !checkIsAdmin(currentUser)) {
      try {
        saveMonthlyPlansToStorage(currentUser, newPlans);
        console.log('✅ 월간계획 로컬 저장 성공');
      } catch (error) {
        console.error('❌ 월간계획 저장 실패:', error);
      }
    }
  };

  const updateMonthlyGoals = (newGoals) => {
    console.log('🎯 월간목표 업데이트:', newGoals.length, '개');
    setMonthlyGoals(newGoals);
    
    if (currentUser && !checkIsAdmin(currentUser)) {
      try {
        saveMonthlyGoalsToStorage(currentUser, newGoals);
        console.log('✅ 월간목표 로컬 저장 성공');
      } catch (error) {
        console.error('❌ 월간목표 저장 실패:', error);
      }
    }
  };

  // 사용자 데이터 로드
  const loadCurrentUserData = async (nickname) => {
    if (!nickname) {
      setIsLoading(false);
      setDataLoaded(true);
      return;
    }
    
    console.log('📦 데이터 로딩 시작:', nickname);
    
    const isUserAdmin = checkIsAdmin(nickname);
    
    if (isUserAdmin) {
      console.log('👑 관리자 로그인');
      setIsAdmin(true);
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
      setDataLoaded(true);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsAdmin(false);
      console.log('📦 일반 사용자 데이터 로딩:', nickname);
      
      let userData = await loadUserDataWithFallback(nickname);
      
      // 기본 데이터가 없으면 생성
      if (!userData || !userData.tags || userData.tags.length === 0) {
        console.log('🆕 기본 데이터 생성');
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
            { tagType: '운동', tagName: '조깅' },
            { tagType: '취미', tagName: '음악 감상' },
            { tagType: '업무', tagName: '회의' }
          ],
          monthlyPlans: userData?.monthlyPlans || [],
          monthlyGoals: userData?.monthlyGoals || []
        };
      }
      
      // 상태 설정
      setSchedules(userData.schedules || []);
      setTags(userData.tags || []);
      setTagItems(userData.tagItems || []);
      setMonthlyPlans(userData.monthlyPlans || []);
      setMonthlyGoals(userData.monthlyGoals || []);
      
      console.log('✅ 데이터 로딩 완료:', {
        nickname,
        schedules: userData.schedules?.length || 0,
        tags: userData.tags?.length || 0,
        tagItems: userData.tagItems?.length || 0
      });
      
    } catch (error) {
      console.error('❌ 데이터 로딩 실패:', error);
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
    } finally {
      setDataLoaded(true);
      setIsLoading(false);
    }
  };

  // 로그인 상태 확인
  useEffect(() => {
    const checkLoginStatus = async () => {
      const nickname = localStorage.getItem('nickname');
      const userType = localStorage.getItem('userType');
      
      console.log('🔐 로그인 정보:', { nickname, userType });
      
      if (nickname) {
        setIsLoggedIn(true);
        setCurrentUser(nickname);
        await loadCurrentUserData(nickname);
      } else {
        setIsLoading(false);
        setDataLoaded(true);
      }
    };
    
    checkLoginStatus();
  }, []);

  // 관리자용 함수들
  const getAllUsers = () => {
    const users = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('-')) {
        const [nickname] = key.split('-');
        if (nickname && !ADMIN_USERS.includes(nickname)) {
          users.add(nickname);
        }
      }
    }
    return Array.from(users);
  };

  const getUserData = (nickname) => {
    if (!nickname) return { schedules: [], tags: [], tagItems: [], monthlyPlans: [], monthlyGoals: [] };
    return loadAllUserData(nickname);
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
        monthlyGoals: userData.monthlyGoals?.length || 0
      };
    });
    return stats;
  };

  // 로그아웃
  const handleLogout = () => {
    console.log('🚪 로그아웃');
    localStorage.removeItem('nickname');
    localStorage.removeItem('userType');
    setIsLoggedIn(false);
    setCurrentUser('');
    setSchedules([]);
    setTags([]);
    setTagItems([]);
    setMonthlyPlans([]);
    setMonthlyGoals([]);
    setIsAdmin(false);
    setDataLoaded(true);
    setIsLoading(false);
    
    setTimeout(() => {
      window.location.href = '#/login';
    }, 100);
  };

  const handleAdminLogout = () => {
    handleLogout();
  };

  // 로딩 화면
  if (isLoading && !dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LogInPage />} />
        
        <Route
          path="/"
          element={(() => {
            const nickname = localStorage.getItem('nickname');
            const userType = localStorage.getItem('userType');
            
            if (!nickname || !isLoggedIn) {
              return <Navigate to="/login" replace />;
            }
            
            const isDirectAdmin = userType === 'admin' || ADMIN_USERS.includes(nickname);
            
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
