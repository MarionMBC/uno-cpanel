'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/overlays/Modal';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import { AppUser, AppRole, RolePermissions } from '@/types';

type Tab = 'usuarios' | 'roles';

export default function UsuariosScreen() {
  const { users, roles, saveUser, saveRole } = useApp();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('usuarios');

  // User State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [draftUser, setDraftUser] = useState<Partial<AppUser>>({ name: '', email: '', roleId: 'operador', status: 'activo' });
  const [confirmToggleUser, setConfirmToggleUser] = useState<AppUser | null>(null);

  // Role State
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [draftRole, setDraftRole] = useState<Partial<AppRole>>({ name: '', permissions: { canManageUsers: false, canManagePumps: false, canCloseDay: false, canEditPrices: false, canViewAudit: false, canManageInventory: false } });

  const handleSaveUser = async () => {
    if (!draftUser.email || !draftUser.name || !draftUser.roleId) {
      toast.error('Datos incompletos', 'Nombre, email y rol son obligatorios.');
      return;
    }
    await saveUser(draftUser as AppUser);
    toast.success('Usuario guardado', `${draftUser.name} ha sido guardado correctamente.`);
    setUserModalOpen(false);
  };

  const handleToggleUserStatus = async () => {
    if (!confirmToggleUser) return;
    const newStatus = confirmToggleUser.status === 'activo' ? 'inactivo' : 'activo';
    await saveUser({ ...confirmToggleUser, status: newStatus });
    toast.success('Estado actualizado', `${confirmToggleUser.name} ahora está ${newStatus}.`);
    setConfirmToggleUser(null);
  };

  const handleSaveRole = async () => {
    if (!draftRole.name) {
      toast.error('Nombre requerido', 'El rol debe tener un nombre.');
      return;
    }
    const roleToSave = {
      ...draftRole,
      id: draftRole.id || draftRole.name.toLowerCase().replace(/\s+/g, '-'),
    } as AppRole;
    await saveRole(roleToSave);
    toast.success('Rol guardado', `El rol ${roleToSave.name} se ha guardado.`);
    setRoleModalOpen(false);
  };

  const togglePermission = (perm: keyof RolePermissions) => {
    setDraftRole(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions!,
        [perm]: !prev.permissions![perm]
      }
    }));
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Seguridad</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Usuarios y Roles</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Administra el acceso al sistema y define qué puede hacer cada rol.</div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0', marginBottom: 8 }}>
        <button onClick={() => setActiveTab('usuarios')} style={{
          padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: activeTab === 'usuarios' ? 800 : 600,
          color: activeTab === 'usuarios' ? '#0f172a' : '#64748b',
          borderBottom: activeTab === 'usuarios' ? '3px solid #fbbf24' : '3px solid transparent',
        }}>Usuarios</button>
        <button onClick={() => setActiveTab('roles')} style={{
          padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: activeTab === 'roles' ? 800 : 600,
          color: activeTab === 'roles' ? '#0f172a' : '#64748b',
          borderBottom: activeTab === 'roles' ? '3px solid #fbbf24' : '3px solid transparent',
        }}>Roles y Permisos</button>
      </div>

      {activeTab === 'usuarios' && (
        <Card padding={0}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Usuarios del Sistema</div>
            <Button variant="primary" icon="plus" onClick={() => { setDraftUser({ name: '', email: '', roleId: 'operador', status: 'activo' }); setUserModalOpen(true); }}>Nuevo usuario</Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {users.map(u => {
              const r = roles.find(role => role.id === u.roleId);
              return (
                <div key={u.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 999, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#64748b', fontWeight: 800 }}>
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{u.name}</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>{u.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Rol asignado</div>
                      <Badge tone={r?.id === 'admin' ? 'primary' : 'neutral'}>{r?.name || 'Desconocido'}</Badge>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Estado</div>
                      {u.status === 'activo' ? <Badge tone="success" dot>Activo</Badge> : <Badge tone="warning">Inactivo</Badge>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="secondary" icon="edit" size="sm" onClick={() => { setDraftUser(u); setUserModalOpen(true); }}>Editar</Button>
                      <Button variant={u.status === 'activo' ? 'danger' : 'primary'} icon={u.status === 'activo' ? 'minus' : 'check'} size="sm" onClick={() => setConfirmToggleUser(u)}>
                        {u.status === 'activo' ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {roles.map(role => (
            <Card key={role.id} padding={20}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{role.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{users.filter(u => u.roleId === role.id).length} usuarios asignados</div>
                </div>
                <Button variant="secondary" icon="edit" size="sm" onClick={() => { setDraftRole(role); setRoleModalOpen(true); }}>Editar</Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'canCloseDay', label: 'Cerrar día y lecturas finales' },
                  { key: 'canManageInventory', label: 'Controlar inventario y pipas' },
                  { key: 'canEditPrices', label: 'Editar precios de combustibles' },
                  { key: 'canManagePumps', label: 'Configurar bombas y surtidores' },
                  { key: 'canViewAudit', label: 'Ver registro de auditoría' },
                  { key: 'canManageUsers', label: 'Administrar usuarios y roles' },
                ].map(p => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#475569' }}>
                    <Icon name={(role.permissions as any)[p.key] ? 'check' : 'minus'} size={14} style={{ color: (role.permissions as any)[p.key] ? '#16a34a' : '#cbd5e1' }}/>
                    {(role.permissions as any)[p.key] ? <span style={{ fontWeight: 600 }}>{p.label}</span> : <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{p.label}</span>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          
          <button onClick={() => { setDraftRole({ name: '', permissions: { canManageUsers: false, canManagePumps: false, canCloseDay: false, canEditPrices: false, canViewAudit: false, canManageInventory: false } }); setRoleModalOpen(true); }} style={{
            border: '2px dashed #cbd5e1', borderRadius: 16, background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 200,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f8fafc', display: 'grid', placeItems: 'center', color: '#64748b' }}>
              <Icon name="plus" size={24}/>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>Crear nuevo rol</div>
          </button>
        </div>
      )}

      {/* User Modal */}
      <Modal open={userModalOpen} onClose={() => setUserModalOpen(false)} title={draftUser.id ? 'Editar usuario' : 'Nuevo usuario'} icon="user" width={400} footer={
        <>
          <Button variant="secondary" onClick={() => setUserModalOpen(false)}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={handleSaveUser}>Guardar usuario</Button>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextField label="Nombre completo" value={draftUser.name || ''} onChange={val => setDraftUser(s => ({ ...s, name: val }))} autoFocus />
          <TextField label="Correo electrónico (Google)" value={draftUser.email || ''} onChange={val => setDraftUser(s => ({ ...s, email: val.toLowerCase() }))} disabled={!!draftUser.id} />
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Rol asignado</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {roles.map(r => (
                <button key={r.id} onClick={() => setDraftUser(s => ({ ...s, roleId: r.id }))} style={{
                  padding: 12, borderRadius: 8, border: draftUser.roleId === r.id ? '2px solid #0f172a' : '1px solid #e2e8f0',
                  background: draftUser.roleId === r.id ? '#f8fafc' : 'white', cursor: 'pointer', textAlign: 'left'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Role Modal */}
      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={draftRole.id ? 'Editar rol' : 'Nuevo rol'} icon="shield" width={480} footer={
        <>
          <Button variant="secondary" onClick={() => setRoleModalOpen(false)}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={handleSaveRole}>Guardar rol</Button>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <TextField label="Nombre del rol" value={draftRole.name || ''} onChange={val => setDraftRole(s => ({ ...s, name: val }))} autoFocus disabled={draftRole.id === 'admin'} />
          
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>Permisos del sistema</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { key: 'canCloseDay', label: 'Cierre de Turno', desc: 'Puede ingresar lectura final de dispensadores y cuadrar inventario.' },
                { key: 'canManageInventory', label: 'Control de Inventario', desc: 'Puede ingresar varillas iniciales y registrar llegada de pipas.' },
                { key: 'canEditPrices', label: 'Gestión de Precios', desc: 'Puede cambiar el precio de los combustibles.' },
                { key: 'canManagePumps', label: 'Configuración de Bombas', desc: 'Puede agregar, editar y eliminar bombas y dispensadores.' },
                { key: 'canViewAudit', label: 'Auditoría', desc: 'Puede visualizar el registro histórico de acciones.' },
                { key: 'canManageUsers', label: 'Administración de Usuarios', desc: 'Puede invitar usuarios, cambiarles el rol y editar los permisos.' },
              ].map(p => {
                const isChecked = !!draftRole.permissions?.[p.key as keyof RolePermissions];
                return (
                  <button key={p.key} onClick={() => togglePermission(p.key as keyof RolePermissions)} disabled={draftRole.id === 'admin'} style={{
                    padding: '12px 16px', background: isChecked ? '#f8fafc' : 'transparent', border: 0, borderBottom: '1px solid #f1f5f9',
                    display: 'flex', alignItems: 'center', gap: 16, cursor: draftRole.id === 'admin' ? 'not-allowed' : 'pointer', textAlign: 'left',
                    opacity: draftRole.id === 'admin' ? 0.7 : 1
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: isChecked ? 'none' : '1px solid #cbd5e1', background: isChecked ? '#16a34a' : 'white', display: 'grid', placeItems: 'center', color: 'white' }}>
                      {isChecked && <Icon name="check" size={14}/>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{p.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm User Toggle */}
      <ConfirmDialog
        open={!!confirmToggleUser}
        onClose={() => setConfirmToggleUser(null)}
        title={confirmToggleUser?.status === 'activo' ? '¿Desactivar usuario?' : '¿Reactivar usuario?'}
        message={confirmToggleUser?.status === 'activo' ? `El usuario ${confirmToggleUser?.name} perderá acceso al sistema inmediatamente.` : `El usuario ${confirmToggleUser?.name} volverá a tener acceso al sistema.`}
        confirmLabel={confirmToggleUser?.status === 'activo' ? 'Desactivar' : 'Activar'}
        icon={confirmToggleUser?.status === 'activo' ? 'minus' : 'check'}
        tone={confirmToggleUser?.status === 'activo' ? 'danger' : 'success'}
        onConfirm={handleToggleUserStatus}
      />
    </div>
  );
}
