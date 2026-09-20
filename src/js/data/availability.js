// End timestamps are exclusive. Publication limits acquisition, not owned units.
import { CUSTOM_SETTINGS } from './custom.js';
export const eventCatalog = () => Array.isArray(CUSTOM_SETTINGS.events) ? CUSTOM_SETTINGS.events : [];
export function withinWindow(item, now = Date.now()) {
  if (!item || item.enabled === false) return false;
  const start = item.availableFrom ? Date.parse(item.availableFrom) : -Infinity;
  const end = item.availableUntil ? Date.parse(item.availableUntil) : Infinity;
  return Number.isFinite(Number(now)) && start < end && now >= start && now < end;
}
export function isAvailable(item, now = Date.now(), events = eventCatalog()) {
  if (!withinWindow(item, now)) return false;
  return !item.eventId || withinWindow(events.find(e => e.id === item.eventId), now);
}
export const activeEvents = (now = Date.now()) => eventCatalog().filter(e => withinWindow(e, now));
export const eventMaterials = () => eventCatalog().filter(e => e.currency?.id).map(e => ({
  ...e.currency, aura: null, color: e.currency.color || '#FFB658', emoji: e.currency.emoji || '🍬'
}));
export const eventShopItems = () => eventCatalog().flatMap(e => (e.shop || []).map(i => ({
  ...i, eventId: e.id, currency: e.currency.id, note: `${e.name}限定`
})));
