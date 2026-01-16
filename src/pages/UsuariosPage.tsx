import React, { useEffect, useState } from 'react';
import { UserService, UserData } from '../services/userService';
import { Edit2, Save, X, UserCog, Check, Key, Plus, Lock } from 'lucide-react';

const AVAILABLE_ROLES = [
  'admin', 'whatsapp', 'precios', 'crm', 'conversaciones', 
  'web1', 'agenda', 'asistencia', 'envios', 'resultados', 'agente'
];

export const UsuariosPage: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // === ESTADOS PARA MODALES ===
  
  // 1. Estado para CREAR usuario
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    roles: [] as string[]
  });

  // 2. Estado para EDITAR usuario (Datos generales)
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    roles: [] as string[]
  });

  // 3. Estado para CAMBIAR CONTRASEÑA
  const [passwordUser, setPasswordUser] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await UserService.getAllUsers();
      // Ordenar por ID para que no salten al editar
      setUsers(data.sort((a, b) => a.id - b.id));
    } catch (err) {
      setError('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  };

  // --- LOGICA DE ROLES ---
  const toggleRole = (
    role: string, 
    currentRoles: string[], 
    setRoles: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (currentRoles.includes(role)) {
      setRoles(currentRoles.filter(r => r !== role));
    } else {
      setRoles([...currentRoles, role]);
    }
  };

  // --- HANDLERS ---

  // 1. Crear Usuario
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await UserService.createUser({
        email: createForm.email,
        password: createForm.password,
        rol: createForm.roles.join(',')
      });
      setIsCreating(false);
      setCreateForm({ email: '', password: '', roles: [] }); // Reset
      await loadUsers();
      alert('Usuario creado con éxito');
    } catch (err) {
      alert('Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  // 2. Editar Usuario (Info General)
  const openEditModal = (user: UserData) => {
    setEditingUser(user);
    const currentRoles = user.rol ? user.rol.split(',').map(r => r.trim()) : [];
    setEditForm({
      email: user.email,
      roles: currentRoles
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setSaving(true);
      await UserService.modifyUser({
        id: editingUser.id,
        email: editForm.email,
        rol: editForm.roles.join(','),
        // ciudad: '' // Se envía vacío implícitamente o lo manejas en el servicio
      });
      setEditingUser(null);
      await loadUsers();
      alert('Usuario modificado con éxito');
    } catch (err) {
      alert('Error al modificar usuario');
    } finally {
      setSaving(false);
    }
  };

  // 3. Cambiar Contraseña
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    try {
      setSaving(true);
      await UserService.changePassword({
        id: passwordUser.id,
        password: newPassword
      });
      setPasswordUser(null);
      setNewPassword('');
      alert('Contraseña actualizada con éxito');
    } catch (err) {
      alert('Error al actualizar contraseña');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando usuarios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <UserCog className="w-8 h-8 text-blue-600" />
          Gestión de Usuarios
        </h1>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus className="w-5 h-5" />
          Nuevo Usuario
        </button>
      </div>

      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-4 w-16">ID</th>
                <th className="p-4">Email</th>
                <th className="p-4">Roles</th>
                <th className="p-4 text-center w-32">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono text-xs">{u.id}</td>
                  <td className="p-4 font-medium text-gray-900">{u.email}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {u.rol?.split(',').map(r => (
                        <span key={r} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-100">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* Botón Editar General */}
                      <button 
                        onClick={() => openEditModal(u)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar datos y roles"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      
                      {/* Botón Cambiar Contraseña */}
                      <button 
                        onClick={() => {
                          setPasswordUser(u);
                          setNewPassword('');
                        }}
                        className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Cambiar contraseña"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL CREAR USUARIO ================= */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Plus className="w-6 h-6 text-blue-600" />
                  Crear Nuevo Usuario
                </h3>
                <button type="button" onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={createForm.email}
                    onChange={e => setCreateForm({...createForm, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={createForm.password}
                    onChange={e => setCreateForm({...createForm, password: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Asignar Roles</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role} className={`
                      flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all
                      ${createForm.roles.includes(role) 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-gray-50 border-transparent hover:bg-gray-100 text-gray-600'}
                    `}>
                      <div className={`
                        w-5 h-5 rounded border flex items-center justify-center
                        ${createForm.roles.includes(role) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}
                      `}>
                        {createForm.roles.includes(role) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={createForm.roles.includes(role)}
                        onChange={() => toggleRole(role, createForm.roles, (newRoles) => setCreateForm(prev => ({...prev, roles: typeof newRoles === 'function' ? newRoles(prev.roles) : newRoles})))}
                      />
                      <span className="text-sm font-medium capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t space-x-3">
                <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  {saving ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL EDITAR USUARIO ================= */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800">Editar Usuario #{editingUser.id}</h3>
                <button type="button" onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                />
              </div>

              {/* CIUDAD OCULTA VISUALMENTE SEGUN REQUERIMIENTO */}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Roles (Permisos)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {AVAILABLE_ROLES.map(role => (
                    <label key={role} className={`
                      flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all
                      ${editForm.roles.includes(role) 
                        ? 'bg-blue-50 border-blue-200 text-blue-700' 
                        : 'bg-gray-50 border-transparent hover:bg-gray-100 text-gray-600'}
                    `}>
                      <div className={`
                        w-5 h-5 rounded border flex items-center justify-center
                        ${editForm.roles.includes(role) ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}
                      `}>
                        {editForm.roles.includes(role) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={editForm.roles.includes(role)}
                        onChange={() => toggleRole(role, editForm.roles, (newRoles) => setEditForm(prev => ({...prev, roles: typeof newRoles === 'function' ? newRoles(prev.roles) : newRoles})))}
                      />
                      <span className="text-sm font-medium capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t space-x-3">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  {saving ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar Cambios</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CAMBIAR PASSWORD ================= */}
      {passwordUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Lock className="w-6 h-6 text-yellow-500" />
                  Cambiar Contraseña
                </h3>
                <button type="button" onClick={() => setPasswordUser(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-lg">
                Editando contraseña para: <strong>{passwordUser.email}</strong>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                <input
                  type="text"
                  required
                  placeholder="Ingresa la nueva contraseña"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-4 border-t space-x-3">
                <button type="button" onClick={() => setPasswordUser(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2">
                  {saving ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};