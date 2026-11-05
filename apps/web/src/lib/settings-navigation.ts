export const SETTINGS_BEFORE_LEAVE_EVENT = 'settings:before-leave';

export const canLeaveSettings = (): boolean =>
  window.dispatchEvent(new Event(SETTINGS_BEFORE_LEAVE_EVENT, { cancelable: true }));
