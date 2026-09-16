export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid backup file.');
  for (const key of ['inventory', 'sales', 'expenses', 'subs', 'notes', 'templates']) {
    if (!Object.hasOwn(data, key) && !['inventory', 'sales', 'expenses'].includes(key)) continue;
    if (!Array.isArray(data[key]) || data[key].some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
      throw new Error(`Invalid ${key} in backup. No data was imported.`);
    }
  }
  if (data.settings !== undefined) {
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) throw new Error('Invalid settings in backup.');
    for (const key of ['categories', 'platforms', 'paymentMethods', 'customers']) {
      if (data.settings[key] !== undefined && (!Array.isArray(data.settings[key]) || data.settings[key].some((value) => typeof value !== 'string'))) {
        throw new Error(`Invalid settings.${key} in backup.`);
      }
    }
  }
}

export async function requireSaved(promise) {
  const result = await promise;
  if (!result?.ok || result.superseded) throw new Error(result?.error || 'Save was superseded by a newer edit.');
  return result;
}
