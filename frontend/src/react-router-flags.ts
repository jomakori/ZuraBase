// Ensure these flags run before any react-router-dom imports.
// This module should be imported as the very first thing in the app entry.
(window as any).__REACT_ROUTER_FUTURE_FLAGS__ = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
};
