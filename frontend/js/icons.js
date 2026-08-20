// Inline SVG icons (Lucide). No external runtime dependency.
// Each function returns a complete SVG string. Use via `el("span", { html: icon("bot") })`.

import { MARK_PATHS } from "./components/logo.js?v=30";

const SVG_BASE = (paths, { width = 16, height = 16, stroke = 2 } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const PATHS = {
  // Navigation / brand
  bot: `<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>`,
  sparkles: `<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>`,
  imageSparkles: `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M0.576355 6.73281c0.377607 -0.06826 0.766565 -0.1039 1.163835 -0.1039 1.57942 0 3.02726 0.56331 4.15358 1.5" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M5.07635 10.6289h-3.5c-0.26521 0 -0.51957 -0.1054 -0.707102 -0.2929 -0.187536 -0.1875 -0.292893 -0.44188 -0.292893 -0.70709v-8c0 -0.26522 0.105357 -0.51957 0.292893 -0.707111 0.187532 -0.187536 0.441892 -0.292893 0.707102 -0.292893h8c0.26522 0 0.51955 0.105357 0.70715 0.292893 0.1875 0.187541 0.2929 0.441891 0.2929 0.707111v3.5" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6.32635 5.62891c0.69036 0 1.25 -0.55965 1.25 -1.25 0 -0.69036 -0.55964 -1.25 -1.25 -1.25 -0.69035 0 -1.25 0.55964 -1.25 1.25 0 0.69035 0.55965 1.25 1.25 1.25Z" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M7.33955 10.5629c-0.35093 -0.0611 -0.35093 -0.56487 0 -0.62592 1.27136 -0.22118 2.28255 -1.18955 2.5585 -2.45015l0.02115 -0.09663c0.07593 -0.34683 0.5698 -0.34899 0.6487 -0.00284l0.0257 0.11261c0.2862 1.25466 1.2976 2.21484 2.5655 2.43541 0.3527 0.06136 0.3527 0.56772 0 0.62912 -1.2679 0.2205 -2.2793 1.1807 -2.5655 2.4354l-0.0257 0.1126c-0.0789 0.3461 -0.57277 0.344 -0.6487 -0.0029l-0.02115 -0.0966c-0.27595 -1.2606 -1.28714 -2.229 -2.5585 -2.4501Z" stroke-width="1"/>`,
  userProfile: `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M10.7045 12.0345c-0.2065 -0.7775 -0.653 -1.4723 -1.27879 -1.9838 -0.68453 -0.55951 -1.54144 -0.86515 -2.42553 -0.86515 -0.88409 0 -1.74099 0.30564 -2.42552 0.86515 -0.62578 0.5115 -1.07231 1.2063 -1.27876 1.9838" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M7 13.5c4.16 0 6.5 -2.34 6.5 -6.5S11.16 0.5 7 0.5 0.5 2.84 0.5 7s2.34 6.5 6.5 6.5Z" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6.99902 7.58008c1.4 0 2.1875 -0.7875 2.1875 -2.1875s-0.7875 -2.1875 -2.1875 -2.1875 -2.1875 0.7875 -2.1875 2.1875 0.7875 2.1875 2.1875 2.1875Z" stroke-width="1"/>`,
  preferences: `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M1 7h4.5" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M1 11.7188h9" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M8.5 7H13" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M13 2.28101H4" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M1 2.28125c0 0.96 0.54 1.5 1.5 1.5s1.5 -0.54 1.5 -1.5 -0.54 -1.5 -1.5 -1.5 1.5 0.54 -1.5 1.5Z" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M10 11.7187c0 0.96 0.54 1.5 1.5 1.5s1.5 -0.5399 1.5 -1.4999c0 -0.9601 -0.54 -1.5001 -1.5 -1.5001s-1.5 0.54 -1.5 1.5Z" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M5.52344 7c0 0.96 0.54 1.5 1.5 1.5s1.5 -0.54 1.5 -1.5 -0.54 -1.5 -1.5 -1.5 0.54 -1.5 1.5Z" stroke-width="1"/>`,
  planUsage: `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M12.4809 5.89042H8.79114C8.08618 1.88565 9.86607 0.970708 10.906 1.00071c2.1599 0.33598 1.9849 3.3998 1.5749 4.88971Z" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M8.22499 12.5203C10.8734 9.43194 6.3021 2.29383 10.5511 1.00073H3.59127c-4.07156 1.2931 0.14398 8.66835 -2.32613 11.27467 0 0 0.83971 0.7246 3.41743 0.7246 2.57772 0 3.54242 -0.4797 3.54242 -0.4797Z" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m4.33691 3.93921 1.85539 0" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m4.57666 7.00024 1.85539 0" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m4.57666 10.0615 1.85539 0" stroke-width="1"/>`,
  about: `<path d="M9 15c0.85038 0.6303 1.8846 1 3 1s2.1496 -0.3697 3 -1" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"/><path fill="currentColor" d="M14 9.5a1 1.5 0 1 0 2 0 1 1.5 0 1 0 -2 0" stroke-width="1.5"/><path fill="currentColor" d="M8 9.5a1 1.5 0 1 0 2 0 1 1.5 0 1 0 -2 0" stroke-width="1.5"/><path d="M22 19.723v-7.4224C22 6.61173 17.5228 2 12 2 6.47715 2 2 6.61173 2 12.3006v7.4224c0 1.3223 1.35098 2.1824 2.4992 1.591 0.92806 -0.478 2.0336 -0.4071 2.89694 0.1858 0.97122 0.6669 2.2365 0.6669 3.20776 0l0.3526 -0.2422c0.6319 -0.4339 1.4551 -0.4339 2.087 0l0.3526 0.2422c0.9713 0.6669 2.2365 0.6669 3.2078 0 0.8633 -0.5929 1.9688 -0.6638 2.8969 -0.1858C20.649 21.9054 22 21.0453 22 19.723Z" stroke="currentColor" stroke-width="1.5"/>`,
  helpStudy: `<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M10 12.5002c1.3807 0 2.5 -1.1192 2.5 -2.5 0 -1.38067 -1.1193 -2.49996 -2.5 -2.49996 -1.38071 0 -2.5 1.11929 -2.5 2.49996 0 1.3808 1.11929 2.5 2.5 2.5Z" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="m13.4995 13.4998 -1.73 -1.73" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M7 2.00024v0C7 1.17182 6.32843 0.500244 5.5 0.500244h-5V10.5002h5" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M7 2.00024v4.5" stroke-width="1"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M7 2v0C7 1.17157 7.67157 0.5 8.5 0.5h5v7.00024" stroke-width="1"/>`,
  arrowRight: `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`,
  arrowLeft: `<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>`,
  send: `<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.112z"/><path d="m21.854 2.147-10.94 10.939"/>`,
  square: `<rect width="18" height="18" x="3" y="3" rx="2"/>`,
  pencil: `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
  cornerDown: `<polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>`,

  // Brand / sections
  messageSquare: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  messageText: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M7 9h10"/><path d="M7 13h6"/>`,
  headphones: `<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>`,
  headset: `<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>`,
  messagesSquare: `<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>`,
  chatBubbles: `<path d="M20.203 15.028c-0.047-0.169 0.056-0.403 0.155-0.572a1.579 1.579 0 0 1 0.098-0.145A7.594 7.594 0 0 0 21.75 10.078c0.014-4.322-3.633-7.828-8.142-7.828C9.675 2.25 6.394 4.927 5.625 8.48a7.533 7.533 0 0 0-0.173 1.603c0 4.327 3.506 7.927 8.016 7.927 0.717 0 1.683-0.216 2.213-0.361s1.055-0.338 1.191-0.389a1.239 1.239 0 0 1 0.436-0.08 1.219 1.219 0 0 1 0.473 0.094L20.438 18.216a0.634 0.634 0 0 0 0.183 0.047 0.375 0.375 0 0 0 0.375-0.375 0.602 0.602 0 0 0-0.023-0.127Z"/><path d="M3.115 10.875a6.855 6.855 0 0 0 0.3 7.156c0.108 0.164 0.169 0.29 0.15 0.375s-0.559 2.9-0.559 2.9a0.375 0.375 0 0 0 0.127 0.36A0.383 0.383 0 0 0 3.375 21.75a0.34 0.34 0 0 0 0.136-0.028l2.635-1.031a0.736 0.736 0 0 1 0.562 0.009c0.888 0.346 1.869 0.562 2.851 0.562A7.463 7.463 0 0 0 13.312 20.255"/>`,
  barChart3: `<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>`,
  settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
  plus: `<path d="M5 12h14"/><path d="M12 5v14"/>`,
  monitor: `<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`,
  moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`,
  logOut: `<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>`,
  trash: `<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  menu: `<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>`,

  // Status / feedback
  check: `<polyline points="20 6 9 17 4 12"/>`,
  checkCircle: `<circle cx="12" cy="12" r="10"/><polyline points="8.5 12 11 14.5 15.5 9.5"/>`,
  xCircle: `<circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>`,
  alert: `<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>`,
  lifeBuoy: `<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>`,
  bug: `<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>`,
  alertOnly: `<line x1="12" x2="12" y1="6" y2="12"/><line x1="12" x2="12.01" y1="18" y2="18"/>`,
  info: `<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>`,
  infoOnly: `<line x1="12" x2="12" y1="18" y2="12"/><line x1="12" x2="12.01" y1="6" y2="6"/>`,
  star: `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>`,
  thumbsUp: `<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/>`,
  thumbsDown: `<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z"/>`,
  copy: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  externalLink: `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
  refresh: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>`,

  // Concepts
  shield: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
  database: `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>`,
  cpu: `<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>`,
  zap: `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`,
  brain: `<path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>`,
  // Ghost — slightly wider silhouette so corner marks don't look tall/thin.
  incognito: `<path d="M12 2.75c-4.7 0-8.25 3.15-8.25 7.15v11.35c0 .55.7.82 1.02.38L8 18.2l2.85 2.95a1.15 1.15 0 0 0 1.9 0L15.6 18.2l3.23 3.43c.32.44 1.02.17 1.02-.38V9.9C19.85 5.9 16.7 2.75 12 2.75z"/><circle cx="9.15" cy="10.6" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.85" cy="10.6" r="1.4" fill="currentColor" stroke="none"/>`,
  lock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  key: `<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  user: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  trendingUp: `<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>`,
  activity: `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`,
  server: `<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>`,
  compass: `<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>`,
  sliders: `<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>`,
  github: `<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>`,
  download: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>`,

  // Loading
  loader: `<path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/>`,

  // Voice input
  mic: `<path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>`,
  audioLines: `<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>`,
  micOff: `<line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/>`,
  chevronDown: `<path d="m6 9 6 6 6-6"/>`,
  moreVertical: `<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>`,
  pin: `<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4.76"/>`,
  pinOff: `<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4.76"/><line x1="2" x2="22" y1="2" y2="22"/>`,

  // Attachments menu
  image: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`,
  fileText: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
  camera: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`,
};

const CONFIG_MAP = {
  imageSparkles: { viewBox: "0 0 14 14" },
  userProfile: { viewBox: "0 0 14 14" },
  preferences: { viewBox: "0 0 14 14" },
  planUsage: { viewBox: "0 0 14 14" },
  about: { viewBox: "0 0 24 24" },
  helpStudy: { viewBox: "0 0 14 14" },
};

export function icon(name, opts = {}) {
  if (name === "spike" || name === "mark") {
    const w = opts.width || 16;
    const h = opts.height || w;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="328 328 370 370" fill="currentColor" aria-hidden="true">${MARK_PATHS}</svg>`;
  }
  const paths = PATHS[name];
  if (!paths) {
    console.warn(`icon('${name}') not found`);
    return "";
  }
  const cfg = CONFIG_MAP[name];
  if (cfg) {
    const w = opts.width || 16;
    const h = opts.height || w;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${cfg.viewBox}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  }
  return SVG_BASE(paths, opts);
}

export function formatDocIcon(fmt, { width = 18, height = 22 } = {}) {
  const f = (fmt || "md").toLowerCase();
  if (f === "pdf") {
    return `<svg width="${width}" height="${height}" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 3a2 2 0 0 1 2-2h9.586a2 2 0 0 1 1.414.586l3.414 3.414A2 2 0 0 1 19 6.414V21a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3z" fill="#EF4444"/><path d="M13 1v4.5a1.5 1.5 0 0 0 1.5 1.5H19" fill="#FCA5A5"/><path d="M9.8 11.5c.3 1.3 1.3 2.9 2.5 3.4.4.2.8.2 1 .1.3-.2.3-.6.1-1-.4-.8-1.5-1.5-3.6-2.5zm0 0c-.8-1.2-1.3-2.6-1.1-3.2.1-.3.4-.5.7-.5.5 0 .8.8.4 2.2zm0 0c-1.3.8-3.1 1.6-4 1.7-.4.1-.6.3-.6.6 0 .4.4.7 1 .7 1 0 2.3-.9 3.6-2.5z" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (f === "docx" || f === "word" || f === "doc") {
    return `<svg width="${width}" height="${height}" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 3a2 2 0 0 1 2-2h9.586a2 2 0 0 1 1.414.586l3.414 3.414A2 2 0 0 1 19 6.414V21a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3z" fill="#2563EB"/><path d="M13 1v4.5a1.5 1.5 0 0 0 1.5 1.5H19" fill="#93C5FD"/><text x="10" y="17.2" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="800" text-anchor="middle">W</text></svg>`;
  }
  // Markdown default
  return `<svg width="${width}" height="${height}" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 3a2 2 0 0 1 2-2h9.586a2 2 0 0 1 1.414.586l3.414 3.414A2 2 0 0 1 19 6.414V21a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3z" fill="#3B82F6"/><path d="M13 1v4.5a1.5 1.5 0 0 0 1.5 1.5H19" fill="#93C5FD"/><path d="M5.5 11h9M5.5 14.5h9M5.5 18h5.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}
