// Appcopy.jsx - 완전 서버 기반 버전 + 무한동기화 해결 (기존 구조 유지)
import React, { useState, useEffect, useRef, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LogInPage from './pages/LogInPage';
import CalendarPage from './pages/CalendarPage';
import DayDetailPagecopy from './pages/DayDetailPagecopy';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminMemberView from './pages/AdminMemberView';
import { saveUserDataToDAL, loadUserDataFromDAL, supabase } from './pages/utils/supabaseStorage';

const ADMIN_USERS = ['교수님', 'admin', '관리자'];

const ProtectedRoute = ({ children }) => {
  const currentUser = sessionStorage.getItem('currentUser');
  return currentUser ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const currentUser = sessionStorage.getItem('currentUser');
  const userType = sessionStorage.getItem('userType');
  const isAdmin = userType === 'admin' || ADMIN_USERS.includes(currentUser);
  return isAdmin ? children : <Navigate to="/calendar" replace />;
};

function Appcopy() {
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

  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const prevDataRef = useRef({});

  const checkIsAdmin = useCallback((nickname) => {
    const userType = sessionStorage.getItem('userType');
    return userType === 'admin' || ADMIN_USERS.includes(nickname);
  }, []);

  const deepCompare = useCallback((a, b) => JSON.stringify(a) === JSON.stringify(b), []);

  const loadUserDataFromServer = useCallback(async (nickname) => {
    if (!nickname || !supabase) return null;
    const result = await loadUserDataFromDAL(nickname);
    return result.success ? result.data : null;
  }, []);

  const saveUserDataToServer = useCallback(async () => {
    if (!currentUser || isLoading || isAdmin) return;
    const currentData = { schedules, tags, tagItems, monthlyPlans, monthlyGoals };
    if (deepCompare(currentData, prevDataRef.current)) return;
    isSavingRef.current = true;
    try {
      const result = await saveUserDataToDAL(currentUser, currentData);
      if (result.success) {
        prevDataRef.current = currentData;
        setLastSyncTime(new Date());
      }
    } catch (e) {
      console.error("❌ 저장 실패", e);
    } finally {
      isSavingRef.current = false;
    }
  }, [currentUser, isLoading, isAdmin, schedules, tags, tagItems, monthlyPlans, monthlyGoals, deepCompare]);

  const getAllUsersFromServer = useCallback(async () => {
    const { data, error } = await supabase.from('DAL').select('user_name').order('user_name');
    if (error) return [];
    return [...new Set(data.map(i => i.user_name))].filter(n => n && !ADMIN_USERS.includes(n));
  }, []);

  const getUserData = useCallback(async (nickname) => {
    const userData = await loadUserDataFromServer(nickname);
    return userData || { schedules: [], tags: [], tagItems: [], monthlyPlans: [], monthlyGoals: [] };
  }, [loadUserDataFromServer]);

  const getUserStats = useCallback(async () => {
    const users = await getAllUsersFromServer();
    const stats = {};
    for (const user of users) {
      const userData = await getUserData(user);
      stats[user] = {
        schedules: userData.schedules?.length || 0,
        tags: userData.tags?.length || 0,
        tagItems: userData.tagItems?.length || 0,
        monthlyPlans: userData.monthlyPlans?.length || 0,
        monthlyGoals: userData.monthlyGoals?.length || 0
      };
    }
    return stats;
  }, [getAllUsersFromServer, getUserData]);

  const loadCurrentUserData = useCallback(async (nickname) => {
    if (!nickname) return;
    const isUserAdmin = checkIsAdmin(nickname);
    setIsAdmin(isUserAdmin);
    if (isUserAdmin) return setDataLoaded(true);

    const userData = await loadUserDataFromServer(nickname);
    if (userData) {
      setSchedules(userData.schedules || []);
      setTags(userData.tags || []);
      setTagItems(userData.tagItems || []);
      setMonthlyPlans(userData.monthlyPlans || []);
      setMonthlyGoals(userData.monthlyGoals || []);
      prevDataRef.current = userData;
    }
    setDataLoaded(true);
  }, [checkIsAdmin, loadUserDataFromServer]);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const currentUser = sessionStorage.getItem('currentUser');
      if (currentUser) {
        setIsLoggedIn(true);
        setCurrentUser(currentUser);
        await loadCurrentUserData(currentUser);
      }
      setIsLoading(false);
    };
    checkLoginStatus();
  }, [loadCurrentUserData]);

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

  const handleLogout = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    sessionStorage.clear();
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
    isSavingRef.current = false;
    prevDataRef.current = {};
    window.location.href = '#/login';
  }, []);

  const handleAdminLogout = useCallback(() => handleLogout(), [handleLogout]);

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LogInPage />} />
        <Route path="/" element={<Navigate to={isAdmin ? "/admin" : "/calendar"} replace />} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard currentUser={currentUser} onLogout={handleAdminLogout} getAllUsers={getAllUsersFromServer} getUserData={getUserData} getUserStats={getUserStats} /></AdminRoute>} />
        <Route path="/admin/member/:memberName" element={<AdminRoute><AdminMemberView currentUser={currentUser} onLogout={handleAdminLogout} getUserData={getUserData} /></AdminRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage schedules={schedules} setSchedules={setSchedules} tags={tags} setTags={setTags} tagItems={tagItems} setTagItems={setTagItems} monthlyGoals={monthlyGoals} setMonthlyGoals={setMonthlyGoals} currentUser={currentUser} onLogout={handleLogout} lastSyncTime={lastSyncTime} isServerBased={true} /></ProtectedRoute>} />
        <Route path="/day/:date" element={<ProtectedRoute><DayDetailPagecopy schedules={schedules} setSchedules={setSchedules} tags={tags} setTags={setTags} tagItems={tagItems} setTagItems={setTagItems} currentUser={currentUser} onLogout={handleLogout} lastSyncTime={lastSyncTime} isServerBased={true} /></ProtectedRoute>} />
        <Route path="/monthly-plan" element={<ProtectedRoute><MonthlyPlanPage schedules={schedules} setSchedules={setSchedules} tags={tags} setTags={setTags} tagItems={tagItems} setTagItems={setTagItems} monthlyPlans={monthlyPlans} setMonthlyPlans={setMonthlyPlans} monthlyGoals={monthlyGoals} setMonthlyGoals={setMonthlyGoals} currentUser={currentUser} onLogout={handleLogout} lastSyncTime={lastSyncTime} isServerBased={true} /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default Appcopy;
