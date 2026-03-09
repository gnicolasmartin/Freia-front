/**
 * Returns the current user's companyId from localStorage session.
 * Used by providers to auto-stamp companyId on entity creation.
 */
export function getSessionCompanyId(): string | undefined {
  try {
    const raw = localStorage.getItem("freia_user");
    if (!raw) return undefined;
    const user = JSON.parse(raw);
    return user?.companyId ?? undefined;
  } catch {
    return undefined;
  }
}
