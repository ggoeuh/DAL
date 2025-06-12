// time.js - 시간 관련 유틸리티

export const SLOT_HEIGHT = 24;

export const parseTimeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const minutesToTimeString = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

export const pixelToNearestTimeSlot = (pixelPosition) => {
  const slotIndex = Math.round(pixelPosition / SLOT_HEIGHT);
  const totalMinutes = slotIndex * 30;
  return minutesToTimeString(totalMinutes);
};

export const calculateSlotPosition = (time) => {
  const minutes = parseTimeToMinutes(time);
  const slotIndex = minutes / 30;
  return slotIndex * SLOT_HEIGHT;
};

export const getCurrentTimeLine = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  return (totalMinutes / 30) * SLOT_HEIGHT;
};
