/* On_HARU time-of-day appearance.
 * Device-local time only. Does NOT modify the PWA manifest, installed launcher
 * icon, personal notes, or saved settings. All variants use the existing artwork.
 */
(function () {
 'use strict';
 const ICON_URL = './icons/onharu-face-wave-512.png';
 const ICON_STYLE = {
   morning: {filter:'sepia(0.12) saturate(1.08) hue-rotate(-10deg)',tint:'#ffe2cd'},
   day: {filter:'none',tint:null},
   evening: {filter:'sepia(0.21) saturate(1.2) hue-rotate(-14deg)',tint:'#f7bdd0'},
   night: {filter:'brightness(0.85) saturate(0.83) hue-rotate(14deg)',tint:'#a9b9e6'}
 };
 function slotForHour(hour) {
   if (!Number.isFinite(hour) || hour < 0 || hour >= 24) return 'day';
   if (hour >= 5 && hour < 11) return 'morning';
   if (hour >= 11 && hour < 17) return 'day';
   if (hour >= 17 && hour < 20) return 'evening';
   return 'night';
 }
 const icon = document.getElementById('onharu-tab-icon');
 let active = '';
 let loaded = false;
 let iconImage;
 function applyFavicon(part) {
   if (!icon) return;
   if (part === 'day') { icon.href = ICON_URL; return; }
   if (!loaded) return; // Keep static icon until the original artwork loads.
   try {
     const canvas = document.createElement('canvas');
     canvas.width = 96;
     canvas.height = 96;
     const ctx = canvas.getContext('2d');
     if (!ctx) return;
     ctx.filter = ICON_STYLE[part].filter;
     ctx.drawImage(iconImage,0,0,96,96);
     ctx.filter = 'none';
     ctx.globalCompositeOperation = 'soft-light';
     ctx.fillStyle = ICON_STYLE[part].tint;
     ctx.fillRect(0,0,96,96);
     ctx.globalCompositeOperation = 'source-over';
     icon.href = canvas.toDataURL('image/png');
   } catch (_) {
     icon.href = ICON_URL; // Any unsupported canvas/browser must remain installable.
   }
 }
 function refresh() {
   const part = slotForHour(new Date().getHours());
   if (part === active) return part;
   active = part;
   document.documentElement.dataset.onharuDaypart = part;
   applyFavicon(part);
   return part;
 }
 window.OnHaruDaypart = Object.freeze({slotForHour, refresh});
 refresh(); // Before body paints; prevents the incorrect splash background flashing.
 if (typeof Image === 'function') {
   iconImage = new Image();
   iconImage.onload = function () { loaded = true; applyFavicon(active); };
   iconImage.onerror = function () { loaded = false; };
   iconImage.src = ICON_URL;
 }
 document.addEventListener('visibilitychange', function () {
   if (!document.hidden) refresh();
 });
 window.addEventListener('focus', refresh);
 window.setInterval(refresh, 60000); // Corrects boundary transitions while open.
})();
