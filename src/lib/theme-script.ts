// Deliberately NOT a "use client" module: the server root layout inlines
// this string in <head>. Adapted from HomeownerHub
// (packages/ui/src/lib/theme-script.ts) to this app's storage key
// (`theme-mode-v1`, written by ThemeToggle) and class names (`.light` /
// `.dark`; dark is the default when nothing is saved).
//
// Runs before paint: applies the theme class and the collapsed-sidebar
// attribute so neither flashes on load.
export const THEME_INIT_SCRIPT =
  "(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme-mode-v1');if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t!=='light'){t='dark';}d.classList.remove('light','dark');d.classList.add(t);if(localStorage.getItem('sidebar')==='collapsed'){d.setAttribute('data-sidebar','collapsed');}}catch(e){}})();";
