import { insertValue, getAllValues, clearAllValues } from '../database/db.js';

export function saveCounter(value) {
  insertValue(value);
}

export function getHistory() {
  return getAllValues();
}

export function resetHistory() {
  clearAllValues();
}