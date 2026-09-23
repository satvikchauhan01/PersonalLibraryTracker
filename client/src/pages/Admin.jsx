import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  ShieldCheck,
  Users,
  UserCog,
  Ban,
  Sparkles,
  BookOpen,
  UserPlus2,
  Search,
  Check,
  X,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import StatCard from '../components/StatCard';
import Pagination from '../components/Pagination';
import {
  getAdminStats,
  listUsers,
  updateUserRole,
  updateUserBanStatus,
} from '../services/adminService';

const PAGE_SIZE = 10;

const initials = (name) =>
  (name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

const Admin = () => {
  const { user: me } = useContext(AuthContext);

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionError, setActionError] = useState('');
  const [banTargetId, setBanTargetId] = useState(null); // row currently showing the ban-reason form
  const [banReason, setBanReason] = useState('');
  const [busyId, setBusyId] = useState(null);

  const fetchStats = useCallback(() => {
    getAdminStats()
      .then(({ data }) => setStats(data))
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listUsers({ page, limit: PAGE_SIZE, search });
      setUsers(data.users);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (error) {
      setActionError(error.response?.data?.message || 'Failed to load users.');
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounce search input, reset to page 1 on each new query
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const applyUpdate = (updated) => {
    setUsers((prev) => prev.map((u) => (u._id === updated._id ? { ...u, ...updated } : u)));
  };

  const handleRoleToggle = async (targetUser) => {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    if (
      !window.confirm(
        nextRole === 'admin'
          ? `Promote ${targetUser.name || targetUser.email} to admin?`
          : `Demote ${targetUser.name || targetUser.email} to a regular user?`
      )
    ) {
      return;
    }
    setActionError('');
    setBusyId(targetUser._id);
    try {
      const { data } = await updateUserRole(targetUser._id, nextRole);
      applyUpdate(data);
      fetchStats();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Failed to update role.');
    }
    setBusyId(null);
  };

  const handleUnban = async (targetUser) => {
    if (!window.confirm(`Reinstate ${targetUser.name || targetUser.email}?`)) return;
    setActionError('');
    setBusyId(targetUser._id);
    try {
      const { data } = await updateUserBanStatus(targetUser._id, false);
      applyUpdate(data);
      fetchStats();
    } catch (error) {
      setActionError(error.response?.data?.message || 'Failed to reinstate user.');
    }
    setBusyId(null);
  };

  const openBanForm = (targetUser) => {
    setActionError('');
    setBanTargetId(targetUser._id);
    setBanReason('');
  };

  const confirmBan = async (targetUser) => {
    setActionError('');
    setBusyId(targetUser._id);
    try {
      const { data } = await updateUserBanStatus(targetUser._id, true, banReason);
      applyUpdate(data);
      fetchStats();
      setBanTargetId(null);
    } catch (error) {
      setActionError(error.response?.data?.message || 'Failed to suspend user.');
    }
    setBusyId(null);
  };

  return (
    <>
      {/* Screen title */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="text-xs uppercase tracking-widest text-primary font-semibold">
            Admin Only
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <ShieldCheck className="text-primary" /> Admin Panel
        </h1>
        <p className="text-sm text-on-surface-variant max-w-2xl mt-1">
          Platform overview, and tools to manage user roles and suspend abusive accounts.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard
            label="Total Users"
            value={stats.totalUsers}
            icon={Users}
            color="text-primary"
          />
          <StatCard label="Admins" value={stats.totalAdmins} icon={UserCog} color="text-tertiary" />
          <StatCard label="Suspended" value={stats.bannedUsers} icon={Ban} color="text-neu-error" />
          <StatCard
            label="Library Pro"
            value={stats.proUsers}
            icon={Sparkles}
            color="text-secondary"
          />
          <StatCard
            label="Total Books"
            value={stats.totalBooks}
            icon={BookOpen}
            color="text-primary"
          />
          <StatCard
            label="New This Week"
            value={stats.newUsersThisWeek}
            icon={UserPlus2}
            color="text-secondary"
          />
        </div>
      )}

      {/* Search */}
      <div className="p-4 lg:p-5 rounded-neu-xl bg-surface-container-low shadow-neu-lg mb-4 max-w-md">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-11 pr-4 py-3 rounded-full bg-surface-container border-none text-sm text-on-surface placeholder:text-on-surface-variant shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 transition-all"
          />
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-3 rounded-neu-lg bg-surface-container-low shadow-neu-inset-sm text-sm text-neu-error max-w-md">
          {actionError}
        </div>
      )}

      {/* User list */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-xl font-bold text-on-surface">All Users</h2>
        <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs shadow-neu-inset-xs">
          {total} total
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : users.length === 0 ? (
        <div className="text-center py-10 bg-surface rounded-neu-xl shadow-neu-lg text-on-surface-variant">
          No users found.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isSelf = u._id === me?._id;
            const isBusy = busyId === u._id;
            return (
              <div
                key={u._id}
                className="p-4 rounded-neu-xl bg-surface-container-low shadow-neu-lg flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-neu-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold shadow-neu-sm shrink-0">
                      {initials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate flex items-center gap-2">
                        {u.name || 'Unnamed user'}
                        {isSelf && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant shadow-neu-inset-xs">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {u.role === 'admin' && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-container text-tertiary shadow-neu-inset-xs flex items-center gap-1">
                        <UserCog size={12} /> Admin
                      </span>
                    )}
                    {u.isPro && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-container text-secondary shadow-neu-inset-xs flex items-center gap-1">
                        <Sparkles size={12} /> Pro
                      </span>
                    )}
                    {u.isBanned && (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-container text-neu-error shadow-neu-inset-xs flex items-center gap-1"
                        title={u.banReason || undefined}
                      >
                        <Ban size={12} /> Suspended
                      </span>
                    )}
                    <span className="text-xs text-on-surface-variant">
                      Joined {formatDate(u.createdAt)}
                    </span>
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-outline-variant/20">
                    <button
                      onClick={() => handleRoleToggle(u)}
                      disabled={isBusy || (u.isBanned && u.role !== 'admin')}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-surface-container text-primary shadow-neu-xs hover:shadow-neu-inset-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <UserCog size={13} />
                      {u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                    </button>

                    {u.isBanned ? (
                      <button
                        onClick={() => handleUnban(u)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-surface-container text-secondary shadow-neu-xs hover:shadow-neu-inset-sm transition-all disabled:opacity-40"
                      >
                        <Check size={13} /> Reinstate
                      </button>
                    ) : (
                      u.role !== 'admin' &&
                      banTargetId !== u._id && (
                        <button
                          onClick={() => openBanForm(u)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-surface-container text-neu-error shadow-neu-xs hover:shadow-neu-inset-sm transition-all disabled:opacity-40"
                        >
                          <Ban size={13} /> Suspend
                        </button>
                      )
                    )}
                  </div>
                )}

                {banTargetId === u._id && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <input
                      type="text"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      placeholder="Reason (optional)"
                      autoFocus
                      className="flex-1 min-w-[160px] rounded-full border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-xs px-3.5 py-1.5 text-on-surface placeholder:text-outline"
                    />
                    <button
                      onClick={() => confirmBan(u)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-neu-error text-on-neu-error shadow-neu-sm hover:shadow-neu-xs transition-all disabled:opacity-40"
                    >
                      <Ban size={12} /> Confirm
                    </button>
                    <button
                      onClick={() => setBanTargetId(null)}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </>
  );
};

export default Admin;
