import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, RefreshCw, UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import SEO from '../components/SEO';

interface ProfileRow {
  id: string;
  email: string;
  created_at: string;
}

interface LicenseRow {
  id: string;
  user_id: string;
  user_email: string | null;
  license_key: string;
  status: string;
  product_type: string;
  created_at: string;
  expires_at: string | null;
}

interface DeviceRow {
  id: string;
  device_fingerprint: string;
  os_name: string | null;
  app_version: string | null;
  last_seen_at: string;
}

interface ActivationRow {
  id: string;
  license_id: string;
  device_id: string;
  activated_at: string;
  deactivated_at: string | null;
  licenses: { user_email: string | null; license_key: string } | null;
  devices: { device_fingerprint: string; os_name: string | null; app_version: string | null; last_seen_at: string } | null;
}

interface UsageStatRow {
  license_id: string;
  user_id: string;
  total_jobs: number;
  success_jobs: number;
  failed_jobs: number;
  total_input_bytes: number;
  total_output_bytes: number;
  last_used_at: string | null;
  licenses: { user_email: string | null; license_key: string } | null;
}

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString() : '-');
const pickOne = <T,>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const AdminPage = () => {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [activations, setActivations] = useState<ActivationRow[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStatRow[]>([]);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [busyActivationId, setBusyActivationId] = useState<string | null>(null);
  const [busyLicenseId, setBusyLicenseId] = useState<string | null>(null);

  const activeActivations = useMemo(
    () => activations.filter(a => !a.deactivated_at),
    [activations],
  );

  const checkAdmin = async () => {
    const { data, error: rpcError } = await supabase.rpc('is_admin');
    if (rpcError) throw rpcError;
    setIsAdmin(Boolean(data));
  };

  const loadData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [profilesRes, licensesRes, devicesRes, activationsRes, usageRes] = await Promise.all([
        supabase.from('profiles').select('id,email,created_at').order('created_at', { ascending: false }).limit(200),
        supabase
          .from('licenses')
          .select('id,user_id,user_email,license_key,status,product_type,created_at,expires_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('devices')
          .select('id,device_fingerprint,os_name,app_version,last_seen_at')
          .order('last_seen_at', { ascending: false })
          .limit(200),
        supabase
          .from('license_activations')
          .select('id,license_id,device_id,activated_at,deactivated_at,licenses(user_email,license_key),devices(device_fingerprint,os_name,app_version,last_seen_at)')
          .order('activated_at', { ascending: false })
          .limit(200),
        supabase
          .from('license_usage_stats')
          .select('license_id,user_id,total_jobs,success_jobs,failed_jobs,total_input_bytes,total_output_bytes,last_used_at,licenses(user_email,license_key)')
          .order('last_used_at', { ascending: false })
          .limit(200),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (licensesRes.error) throw licensesRes.error;
      if (devicesRes.error) throw devicesRes.error;
      if (activationsRes.error) throw activationsRes.error;
      if (usageRes.error) throw usageRes.error;

      setProfiles((profilesRes.data as ProfileRow[]) || []);
      setLicenses((licensesRes.data as LicenseRow[]) || []);
      setDevices((devicesRes.data as DeviceRow[]) || []);

      const normalizedActivations: ActivationRow[] = ((activationsRes.data as any[]) || []).map((row) => ({
        id: row.id,
        license_id: row.license_id,
        device_id: row.device_id,
        activated_at: row.activated_at,
        deactivated_at: row.deactivated_at,
        licenses: pickOne(row.licenses),
        devices: pickOne(row.devices),
      }));
      setActivations(normalizedActivations);

      const normalizedUsageStats: UsageStatRow[] = ((usageRes.data as any[]) || []).map((row) => ({
        license_id: row.license_id,
        user_id: row.user_id,
        total_jobs: row.total_jobs,
        success_jobs: row.success_jobs,
        failed_jobs: row.failed_jobs,
        total_input_bytes: row.total_input_bytes,
        total_output_bytes: row.total_output_bytes,
        last_used_at: row.last_used_at,
        licenses: pickOne(row.licenses),
      }));
      setUsageStats(normalizedUsageStats);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load admin data';
      setError(message);
    } finally {
      setLoadingData(false);
    }
  };

  const resetActivation = async (activationId: string) => {
    setBusyActivationId(activationId);
    try {
      const { error: updateError } = await supabase
        .from('license_activations')
        .update({
          deactivated_at: new Date().toISOString(),
          deactivated_reason: 'admin_reset',
        })
        .eq('id', activationId)
        .is('deactivated_at', null);
      if (updateError) throw updateError;
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to reset activation';
      alert(message);
    } finally {
      setBusyActivationId(null);
    }
  };

  const resetByLicense = async (licenseId: string) => {
    setBusyLicenseId(licenseId);
    try {
      const { error: updateError } = await supabase
        .from('license_activations')
        .update({
          deactivated_at: new Date().toISOString(),
          deactivated_reason: 'admin_reset_by_license',
        })
        .eq('license_id', licenseId)
        .is('deactivated_at', null);
      if (updateError) throw updateError;
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to reset license device';
      alert(message);
    } finally {
      setBusyLicenseId(null);
    }
  };

  const addAdminEmail = async () => {
    if (!newAdminEmail.trim()) return;
    const target = newAdminEmail.trim().toLowerCase();
    const { error: insertError } = await supabase
      .from('admin_users')
      .upsert({ email: target, is_active: true }, { onConflict: 'email' });
    if (insertError) {
      alert(insertError.message);
      return;
    }
    setNewAdminEmail('');
    alert('관리자 이메일이 추가되었습니다.');
  };

  useEffect(() => {
    const boot = async () => {
      if (!user?.id) {
        setCheckingAdmin(false);
        return;
      }
      try {
        await checkAdmin();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Admin check failed';
        setError(message);
      } finally {
        setCheckingAdmin(false);
      }
    };
    void boot();
  }, [user?.id]);

  useEffect(() => {
    if (!checkingAdmin && isAdmin) {
      void loadData();
    }
  }, [checkingAdmin, isAdmin]);

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] text-[var(--text-color)]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/mypage" replace />;

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] p-6 md:p-10">
      <SEO title="Admin | Velo" canonicalPath="/admin" noindex />

            <div className="max-w-[1350px] mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Shield className="w-7 h-7 text-indigo-500" />
              Admin Console
            </h1>
            <p className="text-[var(--text-muted)] mt-2">
              사용자/라이선스/기기/사용량 관리
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="px-4 py-2 rounded-xl border border-[var(--card-border)] hover:bg-black/5 dark:hover:bg-white/5 font-bold flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </header>

        {error && (
          <div className="p-4 rounded-xl border border-red-400/30 bg-red-500/10 text-red-300 text-sm">
            {error}
          </div>
        )}

        <section className="p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)]">
          <h2 className="text-xl font-black mb-4">관리자 추가</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              className="flex-1 px-4 py-2 rounded-xl bg-[var(--bg-color)] border border-[var(--card-border)]"
            />
            <button
              onClick={() => void addAdminEmail()}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              추가
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <p className="text-sm text-[var(--text-muted)]">사용자 수</p>
            <p className="text-2xl font-black">{profiles.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <p className="text-sm text-[var(--text-muted)]">라이선스 수</p>
            <p className="text-2xl font-black">{licenses.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <p className="text-sm text-[var(--text-muted)]">활성 기기 연결</p>
            <p className="text-2xl font-black">{activeActivations.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
            <p className="text-sm text-[var(--text-muted)]">집계 레코드</p>
            <p className="text-2xl font-black">{usageStats.length}</p>
          </div>
        </section>

        <section className="p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-x-auto">
          <h2 className="text-xl font-black mb-4">라이선스 & 기기 초기화</h2>
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--card-border)]">
                <th className="py-3">Email</th>
                <th className="py-3">Plan</th>
                <th className="py-3">Status</th>
                <th className="py-3">Expires</th>
                <th className="py-3">License Key</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license) => (
                <tr key={license.id} className="border-b border-[var(--card-border)] last:border-none">
                  <td className="py-3 font-medium">{license.user_email || '-'}</td>
                  <td className="py-3">{license.product_type}</td>
                  <td className="py-3">{license.status}</td>
                  <td className="py-3">{fmt(license.expires_at)}</td>
                  <td className="py-3 font-mono text-xs">{license.license_key}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => void resetByLicense(license.id)}
                      disabled={busyLicenseId === license.id}
                      className="px-3 py-1.5 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
                    >
                      {busyLicenseId === license.id ? '처리중...' : '기기 연결 초기화'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-x-auto">
          <h2 className="text-xl font-black mb-4">활성화 목록</h2>
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--card-border)]">
                <th className="py-3">Email</th>
                <th className="py-3">License</th>
                <th className="py-3">Device Fingerprint</th>
                <th className="py-3">OS/App</th>
                <th className="py-3">Activated</th>
                <th className="py-3">Last Seen</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {activations.map((a) => (
                <tr key={a.id} className="border-b border-[var(--card-border)] last:border-none">
                  <td className="py-3">{a.licenses?.user_email || '-'}</td>
                  <td className="py-3 font-mono text-xs">{a.licenses?.license_key || '-'}</td>
                  <td className="py-3 font-mono text-xs">{a.devices?.device_fingerprint || '-'}</td>
                  <td className="py-3">{`${a.devices?.os_name || '-'} / ${a.devices?.app_version || '-'}`}</td>
                  <td className="py-3">{fmt(a.activated_at)}</td>
                  <td className="py-3">{fmt(a.devices?.last_seen_at)}</td>
                  <td className="py-3 text-right">
                    {a.deactivated_at ? (
                      <span className="text-[var(--text-muted)]">해제됨</span>
                    ) : (
                      <button
                        onClick={() => void resetActivation(a.id)}
                        disabled={busyActivationId === a.id}
                        className="px-3 py-1.5 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {busyActivationId === a.id ? '처리중...' : '해제'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-x-auto">
          <h2 className="text-xl font-black mb-4">사용 집계 (환불 검토용)</h2>
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--card-border)]">
                <th className="py-3">Email</th>
                <th className="py-3">License</th>
                <th className="py-3">Total Jobs</th>
                <th className="py-3">Success</th>
                <th className="py-3">Failed</th>
                <th className="py-3">Input Bytes</th>
                <th className="py-3">Output Bytes</th>
                <th className="py-3">Last Used</th>
              </tr>
            </thead>
            <tbody>
              {usageStats.map((s) => (
                <tr key={s.license_id} className="border-b border-[var(--card-border)] last:border-none">
                  <td className="py-3">{s.licenses?.user_email || '-'}</td>
                  <td className="py-3 font-mono text-xs">{s.licenses?.license_key || '-'}</td>
                  <td className="py-3">{s.total_jobs}</td>
                  <td className="py-3">{s.success_jobs}</td>
                  <td className="py-3">{s.failed_jobs}</td>
                  <td className="py-3">{s.total_input_bytes.toLocaleString()}</td>
                  <td className="py-3">{s.total_output_bytes.toLocaleString()}</td>
                  <td className="py-3">{fmt(s.last_used_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-x-auto">
          <h2 className="text-xl font-black mb-4">사용자 목록</h2>
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--card-border)]">
                <th className="py-3">User ID</th>
                <th className="py-3">Email</th>
                <th className="py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-[var(--card-border)] last:border-none">
                  <td className="py-3 font-mono text-xs">{p.id}</td>
                  <td className="py-3">{p.email}</td>
                  <td className="py-3">{fmt(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="p-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-x-auto">
          <h2 className="text-xl font-black mb-4">기기 목록</h2>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--card-border)]">
                <th className="py-3">Device ID</th>
                <th className="py-3">Fingerprint</th>
                <th className="py-3">OS</th>
                <th className="py-3">App</th>
                <th className="py-3">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-[var(--card-border)] last:border-none">
                  <td className="py-3 font-mono text-xs">{d.id}</td>
                  <td className="py-3 font-mono text-xs">{d.device_fingerprint}</td>
                  <td className="py-3">{d.os_name || '-'}</td>
                  <td className="py-3">{d.app_version || '-'}</td>
                  <td className="py-3">{fmt(d.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};

export default AdminPage;
