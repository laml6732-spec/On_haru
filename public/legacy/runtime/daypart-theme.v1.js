/* On_HARU time-of-day appearance.
 * Device-local time only. Does NOT modify the PWA manifest, installed launcher
 * icon, personal notes, or saved settings. The approved brand favicon stays fixed across dayparts.
 */
(function () {
 'use strict';
 function slotForHour(hour) {
   if (!Number.isFinite(hour) || hour < 0 || hour >= 24) return 'day';
   if (hour >= 5 && hour < 11) return 'morning';
   if (hour >= 11 && hour < 17) return 'day';
   if (hour >= 17 && hour < 20) return 'evening';
   return 'night';
 }
 let active = '';
 function refresh() {
   const part = slotForHour(new Date().getHours());
   if (part === active) return part;
   active = part;
   document.documentElement.dataset.onharuDaypart = part;
   return part;
 }
 window.OnHaruDaypart = Object.freeze({slotForHour, refresh});
 refresh(); // Before body paints; prevents the incorrect splash background flashing.

 document.addEventListener('visibilitychange', function () {
   if (!document.hidden) refresh();
 });
 window.addEventListener('focus', refresh);
 window.setInterval(refresh, 60000); // Corrects boundary transitions while open.
})();
