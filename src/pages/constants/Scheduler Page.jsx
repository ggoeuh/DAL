// SchedulerPage.jsx
import React, { useState } from "react";
import TimeGrid from "./TimeGrid";
import ScheduleForm from "./ScheduleForm";

const SchedulerPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [tagItems, setTagItems] = useState([]);

  return (
    <div className="flex h-screen">
      <TimeGrid
        schedules={schedules}
        setSchedules={setSchedules}
        tagItems={tagItems}
      />
      <ScheduleForm
        schedules={schedules}
        setSchedules={setSchedules}
        tagItems={tagItems}
        setTagItems={setTagItems}
      />
    </div>
  );
};

export default SchedulerPage;
