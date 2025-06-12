// Appcopy.jsx - 개선된 서버 연동 버전
import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LogInPage from './pages/LogInPage';
import CalendarPage from './pages/CalendarPage';
import DayDetailPagecopy from './pages/DayDetailPagecopy'; // pages 폴더 안의 파일
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMemberView from './pages/AdminMemberView';
// 기존 dataAPI 대신 개선된 unifiedStorage 사용
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

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  return nickname ? children : <Navigate to="/login" replace />;
};

// 관리자 전용 라우트 컴포넌트
const AdminRoute = ({ children }) => {
  const nickname = localStorage.getItem('nickname');
  const isAdmin = nickname === 'admin' || nickname === '관리자';
  return isAdmin ? children : <Navigate to="/calendar" replace />;
};

function Appcopy() {
  // 공유할 상태들을 상위 컴포넌트에서 관리
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState('');

  // 모든 사용자 목록 가져오기 (관리자용)
  const getAllUsers = () => {
    const users = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('-')) {
        const [nickname] = key.split('-');
        if (nickname && nickname !== 'admin' && nickname !== '관리자') {
          users.add(nickname);
        }
      }
    }
    return Array.from(users);
  };

  // 특정 사용자 데이터 가져오기 (관리자용)
  const getUserData = (nickname) => {
    if (!nickname) return {
      schedules: [],
      tags: [],
      tagItems: [],
      monthlyPlans: [],
      monthlyGoals: []
    };
    return loadAllUserData(nickname);
  };

  // 사용자별 통계 가져오기 (관리자용)
  const getUserStats = () => {
    const users = getAllUsers();
    const stats = {};
    users.forEach(user => {
      const userData = loadAllUserData(user);
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

  // 🔧 개발자/디버깅용 수동 백업 함수 (평상시에는 숨김)
  const handleManualServerSync = async (showConfirm = true) => {
    if (!currentUser) return false;

    if (showConfirm && !window.confirm('수동으로 서버와 동기화하시겠습니까?')) {
      return false;
    }

    try {
      console.log('🔧 수동 서버 동기화 시작:', currentUser);
      
      // 현재 상태를 서버에 강제 저장
      const success = await saveUserCoreData(currentUser, {
        schedules,
        tags,
        tagItems,
        monthlyPlans,
        monthlyGoals
      });
      
      if (success) {
        console.log('✅ 수동 서버 동기화 완료:', currentUser);
        alert('✅ 서버 동기화가 완료되었습니다!');
        return true;
      } else {
        throw new Error('서버 동기화 실패');
      }
    } catch (error) {
      console.error('❌ 수동 서버 동기화 실패:', error);
      console.log('⚠️ 자동 저장은 계속 진행됩니다.');
      return false;
    }
  };

  // 🔄 개선된 사용자 데이터 로드 함수 (서버 우선 + 기본 데이터 생성)
  const loadCurrentUserData = async (nickname) => {
    if (!nickname) return;
    
    try {
      setIsLoading(true);
      console.log('📦 사용자 데이터 로딩 시작:', nickname);
      
      // 서버 우선, 로컬 백업으로 데이터 로드
      let userData = await loadUserDataWithFallback(nickname);
      
      // 🎯 새 사용자나 빈 데이터인 경우 기본 데이터 생성
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
        
        // 기본 데이터를 로컬과 서버에 저장
        saveSchedulesToStorage(nickname, userData.schedules);
        saveTagsToStorage(nickname, userData.tags);
        saveTagItemsToStorage(nickname, userData.tagItems);
        saveMonthlyPlansToStorage(nickname, userData.monthlyPlans);
        saveMonthlyGoalsToStorage(nickname, userData.monthlyGoals);
        
        // 서버에도 백업 (백그라운드)
        try {
          await saveUserCoreData(nickname, userData);
          console.log('✅ 기본 데이터 서버 백업 완료');
        } catch (error) {
          console.warn('⚠️ 기본 데이터 서버 백업 실패 (로컬에는 저장됨):', error);
        }
      }
      
      setSchedules(userData.schedules || []);
      setTags(userData.tags || []);
      setTagItems(userData.tagItems || []);
      setMonthlyPlans(userData.monthlyPlans || []);
      setMonthlyGoals(userData.monthlyGoals || []);
      
      console.log('✅ 사용자 데이터 로딩 완료:', {
        nickname,
        schedulesCount: userData.schedules?.length || 0,
        tagsCount: userData.tags?.length || 0,
        tagItemsCount: userData.tagItems?.length || 0,
        monthlyPlansCount: userData.monthlyPlans?.length || 0,
        monthlyGoalsCount: userData.monthlyGoals?.length || 0,
        source: userData.source || 'generated'
      });
      
    } catch (error) {
      console.error('❌ 사용자 데이터 로딩 실패:', error);
      
      // 완전 실패 시 기본값으로 초기화
      setSchedules([]);
      setTags([]);
      setTagItems([]);
      setMonthlyPlans([]);
      setMonthlyGoals([]);
      
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 로그인 상태 확인 및 데이터 로드
  useEffect(() => {
    const checkLoginStatus = async () => {
      const nickname = localStorage.getItem('nickname');
      if (nickname) {
        setIsLoggedIn(true);
        setCurrentUser(nickname);
        await loadCurrentUserData(nickname);
      } else {
        setIsLoading(false);
      }
    };
    checkLoginStatus();
  }, []);

  // 🔄 개선된 자동 저장 (디바운싱 + 서버 백업)
  useEffect(() => {
    if (!currentUser || isLoading) return;
    
    const saveTimer = setTimeout(async () => {
      try {
        // 1. 로컬에 즉시 저장
        saveSchedulesToStorage(currentUser, schedules);
        saveTagsToStorage(currentUser, tags);
        saveTagItemsToStorage(currentUser, tagItems);
        saveMonthlyPlansToStorage(currentUser, monthlyPlans);
        saveMonthlyGoalsToStorage(currentUser, monthlyGoals);
        
        console.log('💾 로컬 자동 저장 완료:', currentUser);
        
        // 2. 서버에 백그라운드 저장 (에러가 나도 사용자 경험에 영향 없음)
        try {
          await saveUserCoreData(currentUser, {
            schedules,
            tags,
            tagItems,
            monthlyPlans,
            monthlyGoals
          });
          console.log('🌐 서버 자동 저장 완료:', currentUser);
        } catch (serverError) {
          console.warn('⚠️ 서버 자동 저장 실패 (로컬은 저장됨):', serverError);
        }
        
      } catch (error) {
        console.error('❌ 자동 저장 실패:', error);
      }
    }, 1000); // 1초 디바운싱
    
    return () => clearTimeout(saveTimer);
  }, [schedules, tags, tagItems, monthlyPlans, monthlyGoals, currentUser, isLoading]);

  // 향상된 상태 업데이트 함수들
  const updateSchedules = (newSchedules) => {
    setSchedules(newSchedules);
  };

  const updateTags = (newTags) => {
    setTags(newTags);
    // 즉시 로컬 저장
    if (currentUser) {
      saveTagsToStorage(currentUser, newTags);
    }
  };

  const updateTagItems = (newTagItems) => {
    setTagItems(newTagItems);
    // 즉시 로컬 저장
    if (currentUser) {
      saveTagItemsToStorage(currentUser, newTagItems);
    }
  };

  const updateMonthlyPlans = (newPlans) => {
    setMonthlyPlans(newPlans);
    // 즉시 로컬 저장
    if (currentUser) {
      saveMonthlyPlansToStorage(currentUser, newPlans);
    }
  };

  const updateMonthlyGoals = (newGoals) => {
    setMonthlyGoals(newGoals);
    // 즉시 로컬 저장
    if (currentUser) {
      saveMonthlyGoalsToStorage(currentUser, newGoals);
    }
  };

  // 로그아웃 함수
  const handleLogout = () => {
    localStorage.removeItem('nickname');
    setIsLoggedIn(false);
    setCurrentUser('');
    setSchedules([]);
    setTags([]);
    setTagItems([]);
    setMonthlyPlans([]);
    setMonthlyGoals([]);
  };

  // 관리자 로그아웃 함수
  const handleAdminLogout = () => {
    handleLogout();
  };

  // 로딩 중일 때 표시할 컴포넌트
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-500 mt-2">서버에서 최신 데이터를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* 로그인 페이지 */}
        <Route path="/login" element={<LogInPage />} />
        
        {/* 루트 경로 - 로그인 상태와 권한에 따라 리다이렉트 */}
        <Route
          path="/"
          element={
            isLoggedIn ? (
              (currentUser === 'admin' || currentUser === '관리자') ?
                <Navigate to="/admin" replace /> :
                <Navigate to="/calendar" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* 🎯 관리자 멤버 상세 캘린더 */}
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

        {/* 관리자 대시보드 */}
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

        {/* 일반 사용자 보호된 라우트들 */}
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

        {/* 주간 캘린더 라우트 */}
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