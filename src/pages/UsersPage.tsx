/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  KeyRound, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Search, 
  Mail, 
  AlertTriangle,
  Loader2,
  Calendar,
  Lock
} from 'lucide-react';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, getSecondaryAuth } from '../config/firebase';
import { UserProfile, UserRole, ShopSettings } from '../types';
import { 
  getUsers, 
  subscribeUsers, 
  saveUserDoc, 
  toggleUserActive, 
  updateUserRole, 
  checkUserHasSales 
} from '../services/dataService';
import { useToast } from '../components/common/ToastContext';
import { MasterPasscodeModal } from '../components/common/MasterPasscodeModal';

interface UsersPageProps {
  currentUser: UserProfile;
  shopSettings: ShopSettings;
}

export const UsersPage: React.FC<UsersPageProps> = ({ currentUser, shopSettings }) => {
  const toast = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'cashier'>('all');

  // Create Staff Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('cashier');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('cashier');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Master passcode modal state for protected actions
  const [passcodeConfig, setPasscodeConfig] = useState<{
    actionTitle: string;
    actionDescription: string;
    onSuccess: () => Promise<void> | void;
  } | null>(null);

  // Real-time listener for users
  useEffect(() => {
    const unsub = subscribeUsers((loadedUsers) => {
      setUsers(loadedUsers);
    });
    return () => unsub();
  }, []);

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  // Handle Create Staff Account using Secondary Firebase App
  const executeCreateStaff = async () => {
    try {
      setIsCreating(true);
      setCreateError(null);

      // Create user using secondary Auth app to prevent logging out the current admin
      const secondaryAuth = getSecondaryAuth();
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newEmail.trim(), newPassword);

      const newProfile: UserProfile = {
        id: userCred.user.uid,
        email: newEmail.trim(),
        displayName: newDisplayName.trim(),
        role: newRole,
        active: true,
        createdAt: new Date().toISOString()
      };

      await saveUserDoc(newProfile);
      // Sign out secondary auth instance immediately
      await secondaryAuth.signOut();

      setIsCreating(false);
      setIsCreateModalOpen(false);
      setNewEmail('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRole('cashier');
      toast.success(`Account created for ${newProfile.displayName} (${newProfile.role})`);
    } catch (err: unknown) {
      setIsCreating(false);
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/email-already-in-use')) {
        setCreateError("An account with this email address already exists.");
      } else if (raw.includes('auth/weak-password')) {
        setCreateError("Password is too weak. Please use at least 6 characters.");
      } else {
        setCreateError(raw.replace('Firebase: ', ''));
      }
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newDisplayName) return;

    if (newPassword.length < 6) {
      setCreateError("Password must be at least 6 characters long.");
      return;
    }

    // Require master passcode if creating an Admin account
    if (newRole === 'admin') {
      setPasscodeConfig({
        actionTitle: "Create Admin Account",
        actionDescription: `You are creating an Admin account for "${newDisplayName}". This grants unrestricted access to financials, settings, and staff accounts. Enter master passcode to authorize.`,
        onSuccess: async () => {
          await executeCreateStaff();
        }
      });
      return;
    }

    await executeCreateStaff();
  };

  // Toggle user active status
  const handleToggleActive = async (user: UserProfile) => {
    if (user.id === currentUser.id) {
      toast.warning("You cannot deactivate your own active session.");
      return;
    }

    const nextState = !user.active;
    try {
      await toggleUserActive(user.id, nextState);
      toast.info(`Account for ${user.displayName} is now ${nextState ? 'Active' : 'Deactivated'}`);
    } catch {
      toast.error("Could not update user status");
    }
  };

  // Send Password Reset Email
  const handleSendPasswordReset = async (user: UserProfile) => {
    try {
      const { auth } = await import('../config/firebase');
      if (!auth) throw new Error("Auth not ready");
      await sendPasswordResetEmail(auth, user.email);
      toast.success(`Password reset link emailed to ${user.email}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to send reset email: ${msg}`);
    }
  };

  // Save Edit User
  const executeSaveEdit = async () => {
    if (!editingUser) return;
    try {
      setIsSavingEdit(true);
      await saveUserDoc({
        ...editingUser,
        displayName: editDisplayName.trim() || editingUser.displayName,
        role: editRole
      });
      setIsSavingEdit(false);
      setEditingUser(null);
      toast.success("User details updated");
    } catch {
      setIsSavingEdit(false);
      toast.error("Could not update user");
    }
  };

  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Check if promoting to Admin role
    if (editRole === 'admin' && editingUser.role !== 'admin') {
      setPasscodeConfig({
        actionTitle: "Promote User to Admin",
        actionDescription: `Promoting "${editingUser.displayName}" to Admin grants full access to financial data, settings, and staff accounts. Enter master passcode to authorize.`,
        onSuccess: async () => {
          await executeSaveEdit();
        }
      });
      return;
    }

    await executeSaveEdit();
  };

  // Delete User with sales check and master passcode
  const handleDeleteUser = async (user: UserProfile) => {
    if (user.id === currentUser.id) {
      toast.warning("Cannot delete your own account");
      return;
    }

    // Check if user has sales
    const hasSales = await checkUserHasSales(user.id);
    if (hasSales) {
      toast.warning("Cannot delete this staff member because they have recorded sales. Deactivate their account instead to preserve audit history.");
      return;
    }

    setPasscodeConfig({
      actionTitle: `Delete Staff Account (${user.displayName})`,
      actionDescription: `Permanently delete the staff record for "${user.displayName}". This action cannot be undone. Enter master passcode to proceed.`,
      onSuccess: async () => {
        if (!db) return;
        try {
          await deleteDoc(doc(db, 'users', user.id));
          toast.info(`Deleted ${user.displayName}`);
        } catch {
          toast.error("Could not delete user document");
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DCE8DC]">
        <div>
          <h2 className="text-xl font-bold text-[#14391A] flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-[#228B22]" />
            Staff &amp; Access Roles
          </h2>
          <p className="text-xs text-slate-500">
            Manage admin and cashier permissions, account activation, and credential recovery
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#228B22]"
          />
        </div>

        <div className="flex rounded-xl border border-[#DCE8DC] overflow-hidden bg-white text-xs font-semibold self-stretch sm:self-auto">
          {(['all', 'admin', 'cashier'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-1.5 capitalize transition-colors ${
                roleFilter === r ? 'bg-[#228B22] text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r === 'all' ? 'All Roles' : `${r}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-[#DCE8DC] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6FAF6] border-b border-[#DCE8DC] text-[#14391A] font-bold">
              <tr>
                <th className="py-3 px-4">STAFF MEMBER</th>
                <th className="py-3 px-4">EMAIL</th>
                <th className="py-3 px-4">ROLE</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">CREATED</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE8DC]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No staff members found matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isActive = u.active !== false;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#14391A]">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            u.role === 'admin' ? 'bg-[#228B22]/15 text-[#228B22]' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-bold">{u.displayName}</span>
                            {isCurrent && (
                              <span className="text-[10px] text-[#228B22] font-semibold">(Current Session)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono-numbers text-slate-600">
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          u.role === 'admin' ? 'bg-emerald-100 text-[#14391A]' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                        }`}>
                          {isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send Password Reset */}
                          <button
                            type="button"
                            onClick={() => handleSendPasswordReset(u)}
                            className="p-1.5 text-slate-500 hover:text-[#228B22] hover:bg-[#228B22]/10 rounded-lg transition-colors"
                            title="Email password reset link"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Role & Name */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setEditRole(u.role);
                              setEditDisplayName(u.displayName);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit Role or Name"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Deactivate / Reactivate */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isActive 
                                  ? 'text-amber-600 hover:bg-amber-50' 
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={isActive ? "Deactivate Account" : "Reactivate Account"}
                            >
                              {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Delete (prevented if sales exist) */}
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete account (blocked if sales recorded)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 border border-[#DCE8DC] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE8DC]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#228B22]/10 text-[#228B22] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#14391A]">Create Staff Account</h3>
                  <p className="text-[11px] text-slate-500">Directly provisions Firebase Auth &amp; Firestore profile</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Solomon Tadesse"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="cashier@sappystationary.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22] font-mono-numbers"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22] font-mono-numbers"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">System Role *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole('cashier')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                      newRole === 'cashier' 
                        ? 'bg-[#228B22] text-white border-[#228B22]' 
                        : 'border-[#DCE8DC] text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Cashier
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                      newRole === 'admin' 
                        ? 'bg-[#228B22] text-white border-[#228B22]' 
                        : 'border-[#DCE8DC] text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Admin
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {newRole === 'cashier' 
                    ? 'Cashier access: POS screen, barcode scanning, stock lookup, own sales history.' 
                    : 'Admin access: Full access to reports, items, bulk import, staff management, and settings.'}
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#DCE8DC] text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{isCreating ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 border border-[#DCE8DC] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DCE8DC]">
              <h3 className="font-bold text-sm text-[#14391A]">Edit Staff Account</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Email</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-slate-50 text-slate-500 font-mono-numbers"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22]"
                >
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 text-xs font-semibold rounded-xl border border-[#DCE8DC] text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2 text-xs font-bold rounded-xl bg-[#228B22] hover:bg-[#1B6E1B] text-white flex items-center justify-center gap-1"
                >
                  {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master Passcode Authorization Modal */}
      {passcodeConfig && (
        <MasterPasscodeModal
          isOpen={true}
          title={passcodeConfig.actionTitle}
          description={passcodeConfig.actionDescription}
          onSuccess={async () => {
            const fn = passcodeConfig.onSuccess;
            setPasscodeConfig(null);
            await fn();
          }}
          onClose={() => setPasscodeConfig(null)}
        />
      )}
    </div>
  );
};
