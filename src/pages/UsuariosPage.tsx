import React, { useEffect, useState, useMemo } from 'react';
import { UserService, UserData } from '../services/userService';
import { 
  Edit3, Save, X, Shield, Check, Key, Plus, Lock, 
  Search, Mail, User, MoreHorizontal, AlertCircle 
} from 'lucide-react';

// Roles disponibles
const AVAILABLE_ROLES = [
  'admin', 'whatsapp', 'precios', 'crm', 'conversaciones', 
  'web1', 'agenda', 'asistencia', 'envios', 'resultados', 'agente'
];

// Helper para colores de roles
const getRoleStyle = (role: string) => {
  switch (role) {
    case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'whatsapp': return 'bg-green-100 text-green-700 border-green-200';
    case 'crm': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'precios': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'resultados': return 'bg-rose-100 text-rose-700 border-rose-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
};

// Helper iniciales
const getInitials = (email: string) => {
  return email.substring(0, 2).toUpperCase();
};

export const UsuariosPage: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // --- MODALES ---
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', roles: [] as string[] });

  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({ email: '', roles: [] as string[] });

  const [passwordUser, setPasswordUser] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await UserService.getAllUsers();
      setUsers(data.sort((a, b) => a.id - b.id));
    } catch (err) {
      setError('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: string, current: string[], setFn: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFn(current.includes(role) ? current.filter(r => r !== role) : [...current, role]);
  };

  // --- CRUD HANDLERS (Misma lógica, mejor UX feedback visual) ---
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await UserService.createUser({ email: createForm.email, password: createForm.password, rol: createForm.roles.join(',') });
      setIsCreating(false);
      setCreateForm({ email: '', password: '', roles: [] });
      await loadUsers();
    } catch { alert('Error al crear'); } finally { setSaving(false); }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    try {
      await UserService.modifyUser({ id: editingUser.id, email: editForm.email, rol: editForm.roles.join(',') });
      setEditingUser(null);
      await loadUsers();
    } catch { alert('Error al editar'); } finally { setSaving(false); }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    setSaving(true);
    try {
      await UserService.changePassword({ id: passwordUser.id, password: newPassword });
      setPasswordUser(null);
      setNewPassword('');
    } catch { alert('Error al cambiar pass'); } finally { setSaving(false); }
  };

  // --- FILTRADO VISUAL ---
  const filteredUsers = useMemo(() => {
    return users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [users, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <Shield className="w-6 h-6 text-white" />
              </div>
              Administración de Usuarios
            </h1>
            <p className="text-slate-500 text-sm mt-1 ml-1">Gestiona accesos y roles del sistema</p>
          </div>
          
          <div className="flex gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar por email..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full md:w-64 transition-all shadow-sm"
              />
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium text-sm">Nuevo Usuario</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* TABLA */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin mb-2" />
              Cargando usuarios...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Usuario</th>
                    <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Roles Asignados</th>
                    <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="group hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-200 shadow-sm">
                            {getInitials(u.email)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{u.email}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2 max-w-md">
                          {u.rol?.split(',').filter(Boolean).map(r => {
                            const role = r.trim();
                            return (
                              <span key={role} className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide ${getRoleStyle(role)}`}>
                                {role}
                              </span>
                            );
                          })}
                          {!u.rol && <span className="text-slate-400 italic text-xs">Sin roles</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingUser(u);
                              setEditForm({ email: u.email, roles: u.rol ? u.rol.split(',').map(r=>r.trim()) : [] });
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Editar roles"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setPasswordUser(u);
                              setNewPassword('');
                            }}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Cambiar contraseña"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                     <tr><td colSpan={3} className="p-8 text-center text-slate-400">No se encontraron usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL CREAR --- */}
      {isCreating && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 rounded-md"><Plus className="w-4 h-4 text-indigo-600" /></div>
                Nuevo Usuario
              </h3>
              <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input required type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})}
                      className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="usuario@empresa.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input required type="text" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})}
                      className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="••••••••" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Roles y Permisos</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                  {AVAILABLE_ROLES.map(role => {
                    const active = createForm.roles.includes(role);
                    return (
                      <label key={role} className={`cursor-pointer flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all ${active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${active ? 'bg-indigo-500 border-indigo-500' : 'bg-slate-100 border-slate-300'}`}>
                          {active && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={active} onChange={() => toggleRole(role, createForm.roles, (r) => setCreateForm(prev => ({...prev, roles: r(prev.roles)})))} />
                        <span className="capitalize">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                 <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg mr-2 transition-colors">Cancelar</button>
                 <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-medium transition-all disabled:opacity-70">
                   {saving ? 'Creando...' : 'Crear Usuario'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR --- */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <div className="p-1.5 bg-blue-100 rounded-md"><Edit3 className="w-4 h-4 text-blue-600" /></div>
                 Editar Usuario #{editingUser.id}
               </h3>
               <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
                <div className="relative">
                   <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                   <input required type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})}
                     className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Roles Asignados</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                  {AVAILABLE_ROLES.map(role => {
                    const active = editForm.roles.includes(role);
                    return (
                      <label key={role} className={`cursor-pointer flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all ${active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${active ? 'bg-blue-500 border-blue-500' : 'bg-slate-100 border-slate-300'}`}>
                          {active && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <input type="checkbox" className="hidden" checked={active} onChange={() => toggleRole(role, editForm.roles, (r) => setEditForm(prev => ({...prev, roles: r(prev.roles)})))} />
                        <span className="capitalize">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                 <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg mr-2 transition-colors">Cancelar</button>
                 <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 font-medium transition-all flex items-center gap-2 disabled:opacity-70">
                   {saving ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar</>}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL PASSWORD --- */}
      {passwordUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
               <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <div className="p-1.5 bg-amber-100 rounded-md"><Key className="w-4 h-4 text-amber-600" /></div>
                 Cambiar Contraseña
               </h3>
               <button onClick={() => setPasswordUser(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-5">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Estás cambiando la clave para <span className="font-bold">{passwordUser.email}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Nueva Contraseña</label>
                <div className="relative">
                   <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                   <input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                     className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="Nueva clave segura" />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                 <button type="button" onClick={() => setPasswordUser(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg mr-2 transition-colors">Cancelar</button>
                 <button type="submit" disabled={saving} className="px-6 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-200 font-medium transition-all disabled:opacity-70">
                   {saving ? 'Actualizando...' : 'Actualizar'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};