import React, { useState } from "react";

const DAYS_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const ScheduleForm = () => {
  const [form, setForm] = useState({
    title: '',
    end: '07:00',
    description: '',
    tag: '',
    repeatCount: '1',
    interval: '1',
    weekdays: []
  });

  const [startSlot, setStartSlot] = useState("07:00");
  const [newTagType, setNewTagType] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagType, setSelectedTagType] = useState("");
  const [tags, setTags] = useState([]);
  const [tagItems, setTagItems] = useState([]);

  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  });

  const repeatOptions = Array.from({ length: 15 }, (_, i) => i + 2);
  const intervalOptions = [
    { value: "1", label: "매주" },
    { value: "2", label: "격주" },
    { value: "3", label: "3주마다" },
    { value: "4", label: "4주마다" }
  ];

  const handleWeekdaySelect = (day) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day]
    }));
  };

  const handleAddTag = () => {
    if (!newTagType.trim() || !newTagName.trim()) return;
    if (!tagItems.find(t => t.tagType === newTagType && t.tagName === newTagName)) {
      setTagItems([...tagItems, { tagType: newTagType, tagName: newTagName }]);
    }
    if (!tags.find(t => t.tagType === newTagType)) {
      setTags([...tags, { tagType: newTagType, color: { bg: "bg-gray-100", text: "text-gray-800" } }]);
    }
    setNewTagType("");
    setNewTagName("");
  };

  const handleDeleteTagItem = (tagType, tagName) => {
    setTagItems(tagItems.filter(item => !(item.tagType === tagType && item.tagName === tagName)));
  };

  const handleSelectTag = (type, name) => {
    setSelectedTagType(type);
    setForm({ ...form, tag: name });
  };

  const handleAdd = () => {
    console.log("추가된 일정:", { ...form, start: startSlot });
    // 이 부분에 실제 데이터 처리 로직 추가 가능
    alert("일정이 추가되었습니다.");
  };

  const parseTimeToMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white overflow-hidden p-4">
      <div className="h-full flex flex-col">
        <h2 className="text-2xl font-bold mt-2 mb-4">일정 추가</h2>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm mb-4">
            <input
              type="text"
              placeholder="일정 명을 적어주세요."
              className="w-full bg-gray-50 border-0 border-b border-gray-200 px-2 py-2 mb-3 focus:outline-none focus:border-gray-400"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />

            <div className="flex gap-3 mb-3">
              <div className="flex-1 relative">
                <div className="flex items-center border rounded-md p-2 bg-white">
                  <select
                    className="ml-2 w-full bg-transparent border-0 focus:outline-none appearance-none"
                    value={startSlot || ""}
                    onChange={(e) => setStartSlot(e.target.value)}
                  >
                    {timeSlots.map(time => (
                      <option key={`start-${time}`} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 relative">
                <div className="flex items-center border rounded-md p-2 bg-white">
                  <select
                    className="ml-2 w-full bg-transparent border-0 focus:outline-none appearance-none"
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                  >
                    {timeSlots
                      .filter((t) => !startSlot || parseTimeToMinutes(t) > parseTimeToMinutes(startSlot))
                      .map(time => (
                        <option key={`end-${time}`} value={time}>{time}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <textarea
              placeholder="내용을 적어주세요"
              className="w-full h-24 bg-white border rounded-md p-3 mb-3 focus:outline-none focus:border-gray-400 resize-none"
              value={form.description || ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            ></textarea>

            <div className="mb-3">
              <h3 className="font-medium mb-2">반복 설정</h3>
              <div className="flex gap-2 mb-2">
                <select
                  className="flex-1 border rounded-md p-2 text-xs"
                  value={form.repeatCount}
                  onChange={(e) => setForm({ ...form, repeatCount: e.target.value })}
                >
                  <option value="1">반복 없음</option>
                  {repeatOptions.map((count) => (
                    <option key={count} value={count}>{count}번 반복</option>
                  ))}
                </select>

                <select
                  className="flex-1 border rounded-md p-2 text-xs"
                  value={form.interval}
                  onChange={(e) => setForm({ ...form, interval: e.target.value })}
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`w-7 h-7 rounded-full border text-xs font-medium transition ${
                      form.weekdays.includes(day)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    onClick={() => handleWeekdaySelect(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <h3 className="font-medium mb-2">태그 선택</h3>
              <div className="h-48 overflow-y-auto pr-1 border rounded-md p-3 bg-white">
                {tagItems.map((item, idx) => {
                  const tagGroup = tags.find(t => t.tagType === item.tagType);
                  const tagColor = tagGroup ? tagGroup.color : { bg: "bg-gray-100", text: "text-gray-800" };

                  return (
                    <div key={idx} className="flex items-center mb-2 last:mb-0">
                      <div className={`w-16 ${tagColor.bg} ${tagColor.text} px-2 py-1 rounded-l-md text-xs font-medium truncate`}>
                        {item.tagType}
                      </div>
                      <div
                        className={`flex-1 ${tagColor.bg} ${tagColor.text} px-2 py-1 text-xs cursor-pointer hover:bg-opacity-80 ${selectedTagType === item.tagType && form.tag === item.tagName ? 'ring-1 ring-blue-400' : ''}`}
                        onClick={() => handleSelectTag(item.tagType, item.tagName)}
                      >
                        {item.tagName}
                      </div>
                      <button
                        className="bg-red-100 text-red-500 rounded-r-md px-2 py-1 text-xs"
                        onClick={() => handleDeleteTagItem(item.tagType, item.tagName)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {tagItems.length === 0 && (
                  <div className="w-full text-center text-gray-500 py-4 text-sm">
                    태그를 추가해주세요
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 mb-1">
              <input
                type="text"
                placeholder="태그"
                className="w-16 text-xs bg-white border rounded-l-md px-2 py-1 focus:outline-none focus:border-gray-400"
                value={newTagType}
                onChange={(e) => setNewTagType(e.target.value)}
              />
              <input
                type="text"
                placeholder="항목 이름"
                className="flex-1 text-xs bg-white border-y border-r-0 px-2 py-1 focus:outline-none focus:border-gray-400"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <button
                className="bg-gray-200 w-8 h-6 rounded-r-md flex items-center justify-center text-sm font-bold"
                onClick={handleAddTag}
              >
                +
              </button>
            </div>
          </div>

          <button
            className="w-full bg-green-100 text-center py-3 rounded-lg text-xl font-medium text-green-800"
            onClick={handleAdd}
          >
            일정 추가하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleForm;
