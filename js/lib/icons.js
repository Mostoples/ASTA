/* ============================================================
   ASTA — Icon set (inline SVG, stroke-based, medical feel)
   Pakai: Icon('pulse', 20) -> string SVG
   ============================================================ */
(function (global) {
  'use strict';

  var P = {
    dashboard: '<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    pulse: '<path d="M3 12h3l2-5 3 10 2.5-7 2 4h5.5"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v9"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-1a2 2 0 0 1 4 0"/>',
    brain: '<path d="M12 5a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 5 16a3 3 0 0 0 4 2.8A2.5 2.5 0 0 0 12 21V5Z"/><path d="M12 5a3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1 2 5.2A3 3 0 0 1 19 16a3 3 0 0 1-4 2.8A2.5 2.5 0 0 1 12 21"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 11h18"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l3.5-4.5L14 14l4-6"/>',
    bars: '<path d="M3 21V10M9 21V4M15 21v-8M21 21V7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.6"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 4.5a3.6 3.6 0 0 1 0 7M18.5 14.6A6.5 6.5 0 0 1 22 21"/>',
    userCheck: '<circle cx="9" cy="8" r="3.8"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="m16 12 2 2 4-4"/>',
    stethoscope: '<path d="M4 3v6a5 5 0 0 0 10 0V3"/><path d="M4 3h2M12 3h2"/><path d="M9 14v2a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="11" r="2.2"/>',
    wrench: '<path d="M14.5 5.5a4.5 4.5 0 1 0 5 5L21 9l-2-2 1-3-3 1-2-2-.5 2.5Z"/><path d="M13 9 4 18a2.1 2.1 0 0 0 3 3l9-9"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.08A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.33-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.08A1.7 1.7 0 0 0 10 3.04V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.52 1Z"/>',
    bluetooth: '<path d="m7 7 10 10-5 4V3l5 4L7 17"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2.5"/><path d="M22 11v2"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    play: '<path d="M6 4l14 8-14 8V4Z"/>',
    pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    check: '<path d="m4 12.5 5.2 5.2L20 7"/>',
    checkCircle: '<circle cx="12" cy="12" r="9.2"/><path d="m8 12.3 2.7 2.7L16.2 9.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.2v.2"/>',
    info: '<circle cx="12" cy="12" r="9.2"/><path d="M12 11v6M12 7.6v.2"/>',
    clock: '<circle cx="12" cy="12" r="9.2"/><path d="M12 7.5V12l3.4 2.2"/>',
    fire: '<path d="M12 22c4 0 6.5-2.6 6.5-6 0-4.6-4-6.4-4-10.5C11 7 9 8.6 9 11c0-1-1-2-1-2-1 1.4-2.5 3.3-2.5 5.9 0 3.5 2.5 7.1 6.5 7.1Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    mirror: '<rect x="3" y="3" width="7.5" height="18" rx="2"/><rect x="13.5" y="3" width="7.5" height="18" rx="2" stroke-dasharray="4 3"/>',
    camera: '<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.3-2h6.6l1.3 2h1.9A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z"/><circle cx="12" cy="13" r="3.6"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2.5"/><path d="m16 11 6-3.5v9L16 13"/>',
    message: '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.4A8 8 0 1 1 21 12Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    arrowUp: '<path d="M12 20V4M6 10l6-6 6 6"/>',
    arrowDown: '<path d="M12 4v16M18 14l-6 6-6-6"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    upload: '<path d="M12 16V4M7 8l5-5 5 5"/><path d="M4 20h16"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
    waves: '<path d="M2 8c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2"/><path d="M2 14c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2"/><path d="M2 20c2 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8.3-8 9.5C7.5 20.3 4 17 4 12V6l8-3Z"/><path d="m9 12 2 2 4-4"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/>',
    home: '<path d="m4 10 8-7 8 7v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z"/><path d="M9.5 21v-6h5v6"/>',
    map: '<path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6l5-2Z"/><path d="M9 4v14M15 6v14"/>',
    trend: '<path d="m3 17 5-5 4 3 6-7"/><path d="M15 8h5v5"/>',
    droplet: '<path d="M12 3s6 6.2 6 10.2a6 6 0 1 1-12 0C6 9.2 12 3 12 3Z"/>',
    thermometer: '<path d="M14 14V5a2.5 2.5 0 0 0-5 0v9a4.5 4.5 0 1 0 5 0Z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M12 20H5a2 2 0 0 1-2-2v-1l11-11 3 3-9 9"/><path d="m15.5 4.5 2-2 3 3-2 2z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3.2"/>',
    star: '<path d="m12 3 2.9 5.9 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.9l1.2-6.5L2.5 9.8l6.6-.9L12 3Z"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14.5-1.5 7 5-2.6 5 2.6-1.5-7"/>',
    wifiOff: '<path d="M2 3l19 19"/><path d="M5 12.5a11 11 0 0 1 3-2M2 8.8A15.6 15.6 0 0 1 8 5.4M12 5c3.5 0 6.7 1.3 9.2 3.4"/><path d="M8.5 16a5.5 5.5 0 0 1 2.5-1.4"/><path d="M12 20v.2"/>',
    link: '<path d="M9.5 14.5 14.5 9.5"/><path d="M7 10 5.3 11.7a4 4 0 0 0 5.7 5.7L12.6 16"/><path d="M17 14l1.7-1.7a4 4 0 0 0-5.7-5.7L11.4 8"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    phone: '<path d="M5 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L15 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.2A2 2 0 0 1 5 3Z"/>',
    hospital: '<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M9 7V4h6v3M12 11v6M9 14h6"/>'
  };

  function Icon(name, size, extraClass) {
    var d = P[name];
    if (!d) d = P.info;
    var s = size || 20;
    return '<svg class="ico-svg ' + (extraClass || '') + '" width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      d + '</svg>';
  }

  Icon.has = function (n) { return !!P[n]; };
  Icon.names = function () { return Object.keys(P); };

  global.Icon = Icon;
})(window);
