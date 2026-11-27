// Shared by manual updates and the generated inline service-worker guard.
export const RELOAD_TIMEOUT = 3000;

export function claimReload(owner, controller, build, retries = []) {
  const history = window.__pomeloV8Reloads || [];
  // A late completion of an activation stays handled even after its claim expires.
  // Only a new user attempt may retry records that already existed at its start.
  if (history.some(record => (controller ? record.controller === controller :
    !record.controller && record.build === build) && !retries.includes(record))) return null;
  const claim = window.__pomeloV8Reloading;
  if (claim && Date.now() - claim.timestamp < RELOAD_TIMEOUT) return null;
  const record = {owner, controller, build, timestamp: Date.now()};
  window.__pomeloV8Reloads = [...history, record];
  window.__pomeloV8Reloading = record;
  return record;
}

export function releaseReload(claim) {
  if (claim && window.__pomeloV8Reloading === claim) delete window.__pomeloV8Reloading;
}
