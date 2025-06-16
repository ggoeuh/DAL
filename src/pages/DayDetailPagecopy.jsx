import React, { useState, useEffect, useRef } from "react";
import { useWeeklyCalendarLogic, createSafeSchedules } from "./WeeklyCalendarLogic";
import { WeeklyCalendarUI } from "./WeeklyCalendarUI";
import { saveUserDataToDAL, loadUserDataFromDAL, supabase } from './utils/supabaseStorage.js';

const WeeklyCalendar = ({ 
  currentUser = 'demo-user',
  onLogout,
  isAdminView = false,
  onBackToDashboard = null
}) => {
  const [schedules, setSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState(null);

  const schedulesRef = useRef(schedules);
  const tagsRef = useRef(tags);
  const tagItemsRef = useRef(tagItems);
  const saveTimeoutRef = useRef(null);
  const loadingRef = useRef(false);

  useEffect(() => { schedulesRef.current = schedules }, [schedules]);
  useEffect(() => { tagsRef.current = tags }, [tags]);
  useEffect(() => { tagItemsRef.current = tagItems }, [tagItems]);

  const loadDataFromServer = async () => {
    if (!currentUser || !supabase || loadingRef.current) return;
    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const result = await loadUserDataFromDAL(currentUser);
      if (result.success && result.data) {
        const serverData = result.data;
        setSchedules(createSafeSchedules(serverData.schedules || []));
        setTags(serverData.tags || []);
        setTagItems(serverData.tagItems || []);
        setLastRefresh(new Date());
      } else {
        setSchedules([]);
        setTags([]);
        setTagItems([]);
      }
    } catch (error) {
      setError('서버 연결에 실패했습니다. 네트워크를 확인해주세요.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const saveDataToServer = async (newSchedules, newTags, newTagItems) => {
    if (!currentUser || isAdminView) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await saveUserDataToDAL(currentUser, {
          schedules: newSchedules,
          tags: newTags,
          tagItems: newTagItems
        });
        setLastRefresh(new Date());
      } catch (error) {
        alert('서버 저장에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setSaving(false);
      }
    }, 500);
  };

  const handleSetSchedules = (newSchedules) => {
    const safe = createSafeSchedules(newSchedules);
    setSchedules(safe);
    saveDataToServer(safe, tagsRef.current, tagItemsRef.current);
  };

  const handleSetTags = (newTags) => {
    setTags(newTags);
    saveDataToServer(schedulesRef.current, newTags, tagItemsRef.current);
  };

  const handleSetTagItems = (newTagItems) => {
    setTagItems(newTagItems);
    saveDataToServer(schedulesRef.current, tagsRef.current, newTagItems);
  };

  useEffect(() => {
    loadDataFromServer();
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleDataRefresh = async (freshData = null) => {
    if (freshData) {
      setSchedules(createSafeSchedules(freshData.schedules || []));
      setTags(freshData.tags || []);
      setTagItems(freshData.tagItems || []);
      setLastRefresh(new Date());
    } else {
      await loadDataFromServer();
    }
  };

  if (loading) {
    return <div className="min-h-screen flex justify-center items-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div>
          <p className="text-red-500">{error}</p>
          <button onClick={loadDataFromServer}>다시 시도</button>
        </div>
      </div>
    );
  }

  const calendarLogic = useWeeklyCalendarLogic({
    schedules,
    setSchedules: handleSetSchedules,
    tags,
    setTags: handleSetTags,
    tagItems,
    setTagItems: handleSetTagItems,
    currentUser
  });

  return (
    <div className="relative">
      <WeeklyCalendarUI
        calendarLogic={calendarLogic}
        currentUser={currentUser}
        onLogout={onLogout}
        saving={saving}
        isAdminView={isAdminView}
        onDataRefresh={handleDataRefresh}
      />
    </div>
  );
};

export default function SimplifiedWeeklyCalendar(props) {
  return <WeeklyCalendar {...props} />;
}
