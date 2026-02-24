type DesktopReleaseMeta = {
  version: string;
  downloadUrl: string;
};

const DESKTOP_VERSION_META_PATH = '/desktop-version.json';

export async function getDesktopDownloadUrl(): Promise<string | null> {
  try {
    const res = await fetch(DESKTOP_VERSION_META_PATH, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<DesktopReleaseMeta>;
    const downloadUrl = typeof data.downloadUrl === 'string' ? data.downloadUrl.trim() : '';
    return downloadUrl || null;
  } catch {
    return null;
  }
}
