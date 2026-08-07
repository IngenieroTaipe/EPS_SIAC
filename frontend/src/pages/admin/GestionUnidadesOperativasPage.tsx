import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, X, Pencil, Power } from 'lucide-react';
import { apiOrganization, type BackendBranch } from '@/services/apiOrganization';
import { apiPlaces, type BackendDistrict } from '@/services/apiPlaces';
import { FilterableSelect, type FilterableOption } from '@/shared/components/FilterableSelect';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useAuth } from '@/shared/context/AuthContext.hooks';

/**
 * GestionUnidadesOperativasPage — ruta `/admin/unidades-operativas`.
 *
 * Administración de Unidades Operativas (modelo `Branch` del backend).
 * Solo accesible para admin (ver `RequireAdmin`). Permite:
 *
 *   - Listar todas las unidades operativas con su distrito y estado.
 *   - Convertir un distrito en unidad operativa ("Nueva Unidad Operativa"):
 *     se elige un distrito del catálogo (`/places/districts/light/`) y se
 *     le asignan `code`, `name` y `acronym` — equivalent a `POST
 *     /organization/branches/`.
 *   - Activar/desactivar una unidad (PATCH `status`).
 *   - Editar datos de una unidad (modal de edición).
 *
 * Estilo: sigue la paleta de `tailwind.config.ts` (primary-main navy,
 * background-main blanco, outline-button-stroke, text-primary/secondary).
 */
interface BranchCreatePayload {
  district: string;
  code: string;
  name: string;
  acronym: string;
  status: boolean;
  observations: string;
}

const EMPTY_FORM: BranchCreatePayload = {
  district: '',
  code: '',
  name: '',
  acronym: '',
  status: true,
  observations: '',
};

export function GestionUnidadesOperativasPage() {
  // useAuth garante (vía RequireAdmin) que el usuario es admin; lo dejamos
  // referenciado para que el guard componga con este contexto.
  useAuth();

  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState<boolean>(true);
  const [districts, setDistricts] = useState<BackendDistrict[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState<boolean>(true);

  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [editing, setEditing] = useState<BackendBranch | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<BranchCreatePayload>(EMPTY_FORM);

  // ── Carga inicial: branches + distritos (catálogo para conversión) ──
  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de carga
       canónica (loading true → fetch → loading false). */
    setBranchesLoading(true);
    apiOrganization
      .listBranches()
      .then((list) => !cancelled && setBranches(list))
      .catch(() => !cancelled && setBranches([]))
      .finally(() => !cancelled && setBranchesLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDistrictsLoading(true);
    apiPlaces
      .listDistrictsLight()
      .then((list) => !cancelled && setDistricts(list))
      .catch(() => !cancelled && setDistricts([]))
      .finally(() => !cancelled && setDistrictsLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, []);

  /** Distritos que aún NO son unidad operativa (filtro en cliente). */
  const availableDistricts = useMemo<FilterableOption[]>(() => {
    const usedUbigeos = new Set(
      branches.map((b) =>
        typeof b.district === 'string' ? b.district : b.district?.ubigeo,
      ),
    );
    return districts
      .filter((d) => !usedUbigeos.has(d.ubigeo))
      .map((d) => ({ value: d.ubigeo, label: `${d.name} (${d.ubigeo})` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [districts, branches]);

  // ── Helpers de formulario ──────────────────────────────────────────
  function resetForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit(branch: BackendBranch) {
    const dist =
      typeof branch.district === 'string' ? branch.district : branch.district?.ubigeo;
    setForm({
      district: dist ?? '',
      code: branch.code,
      name: branch.name,
      acronym: branch.acronym,
      status: branch.status,
      observations: branch.observations ?? '',
    });
    setFormError(null);
    setEditing(branch);
  }

  async function handleSubmitCreate() {
    if (!form.district) {
      setFormError('Selecciona un distrito.');
      return;
    }
    if (!form.code.trim() || !form.name.trim() || !form.acronym.trim()) {
      setFormError('Código, nombre y acrónimo son obligatorios.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiOrganization.createBranch({
        district: form.district,
        code: form.code.trim(),
        name: form.name.trim().toUpperCase(),
        acronym: form.acronym.trim().toUpperCase(),
        status: form.status,
        observations: form.observations.trim() || undefined,
      });
      setBranches((prev) => [...prev, created]);
      setShowCreate(false);
      resetForm();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> | string } };
      const data = e?.response?.data;
      const msg =
        (typeof data === 'object' && data && JSON.stringify(data)) ||
        (typeof data === 'string' && data) ||
        'No se pudo crear la unidad operativa.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEdit() {
    if (!editing) return;
    setSubmitting(true);
    try {
      const updated = await apiOrganization.updateBranch(editing.id, {
        code: form.code.trim(),
        name: form.name.trim().toUpperCase(),
        acronym: form.acronym.trim().toUpperCase(),
        status: form.status,
        observations: form.observations.trim() || undefined,
      });
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setEditing(null);
      resetForm();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> | string } };
      const data = e?.response?.data;
      const msg =
        (typeof data === 'object' && data && JSON.stringify(data)) ||
        (typeof data === 'string' && data) ||
        'No se pudo actualizar la unidad operativa.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(branch: BackendBranch) {
    try {
      const updated = await apiOrganization.updateBranch(branch.id, {
        status: !branch.status,
      });
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch {
      // best-effort; el admin puede reintentar.
    }
  }

  async function handleConfirmDelete() {
    if (confirmDeleteId === null) return;
    try {
      await apiOrganization.deleteBranch(confirmDeleteId);
      setBranches((prev) => prev.filter((b) => b.id !== confirmDeleteId));
    } catch {
      // El backend rechaza delete si hay miembros/sectores asociados (PROTECT).
    } finally {
      setConfirmDeleteId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden p-6 text-text-primary">
      <div className="flex items-center justify-between shrink-0 mb-4">
        <p className="text-sm text-text-secondary font-sans">
          Crea, edita y desactiva las unidades operativas a partir de distritos del catálogo.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                     bg-primary-main text-text-invert-primary font-sans text-sm font-medium
                     hover:bg-primary-light transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Nueva Unidad Operativa
        </button>
      </div>

      {/* ── Tabla de unidades operativas ─────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-input-stroke-main">
        <table className="w-full text-sm font-sans">
          <thead className="sticky top-0 bg-primary-main text-text-invert-primary">
            <tr>
              <th className="text-left px-4 py-3 font-semibold w-16">Código</th>
              <th className="text-left px-4 py-3 font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold w-24">Acrónimo</th>
              <th className="text-left px-4 py-3 font-semibold">Distrito</th>
              <th className="text-left px-4 py-3 font-semibold w-28">Estado</th>
              <th className="text-right px-4 py-3 font-semibold w-44">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {branchesLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  Cargando unidades operativas…
                </td>
              </tr>
            ) : branches.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No hay unidades operativas registradas.
                </td>
              </tr>
            ) : (
              branches.map((b) => {
                const dist =
                  typeof b.district === 'string' ? null : b.district;
                return (
                  <tr
                    key={b.id}
                    className="border-t border-button-stroke hover:bg-primary-states-hover-main/10 transition-colors"
                  >
                    <td className="px-4 py-3">{b.code}</td>
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3">{b.acronym}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {dist ? `${dist.name} (${dist.ubigeo})` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ' +
                          (b.status
                            ? 'bg-success-main/15 text-success-dark'
                            : 'bg-secondary-main/15 text-secondary-main')
                        }
                      >
                        <span
                          className={
                            'size-1.5 rounded-full ' +
                            (b.status ? 'bg-success-main' : 'bg-secondary-main')
                          }
                          aria-hidden="true"
                        />
                        {b.status ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          title="Editar"
                          className="p-1.5 rounded-md text-text-secondary hover:bg-primary-states-hover-main/30 hover:text-primary-main transition-colors"
                        >
                          <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(b)}
                          title={b.status ? 'Desactivar' : 'Activar'}
                          className="p-1.5 rounded-md text-text-secondary hover:bg-primary-states-hover-main/30 hover:text-primary-main transition-colors"
                        >
                          <Power className="size-4" strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(b.id)}
                          title="Eliminar"
                          className="p-1.5 rounded-md text-text-secondary hover:bg-secondary-background hover:text-text-invert-primary transition-colors"
                        >
                          <X className="size-4" strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal Crear / Editar ────────────────────────────────────── */}
      {(showCreate || editing) && (
        <div
          className="fixed inset-0 z-[900] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreate(false);
              setEditing(null);
              resetForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="uo-modal-title"
            className="w-full max-w-lg bg-background-main rounded-section shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="uo-modal-title"
                className="text-xl font-bold font-sans text-primary-main flex items-center gap-2"
              >
                <Building2 className="size-5" strokeWidth={2} aria-hidden="true" />
                {editing ? 'Editar unidad operativa' : 'Nueva unidad operativa'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                  resetForm();
                }}
                className="p-1.5 rounded-md text-text-secondary hover:bg-primary-states-hover-main/30"
                aria-label="Cerrar"
              >
                <X className="size-5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Distrito (solo en creación) */}
              {!editing && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-primary text-sm font-medium font-sans">
                    Distrito <span className="text-secondary-main">*</span>
                  </label>
                  <FilterableSelect
                    value={form.district}
                    onChange={(v) => setForm((f) => ({ ...f, district: v }))}
                    options={availableDistricts}
                    placeholder="Buscar distrito…"
                    emptyLabel={
                      districtsLoading ? 'Cargando…' : '— Selecciona un distrito —'
                    }
                    disabled={districtsLoading}
                  />
                  {availableDistricts.length === 0 && !districtsLoading && (
                    <span className="text-xs text-text-secondary font-sans">
                      Todos los distritos ya son unidades operativas.
                    </span>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-primary text-sm font-medium font-sans">
                    Código <span className="text-secondary-main">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="001"
                    className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                               bg-background-main text-text-primary font-sans text-sm
                               focus:outline-2 focus:outline-primary-main"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-primary text-sm font-medium font-sans">
                    Acrónimo <span className="text-secondary-main">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={form.acronym}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, acronym: e.target.value.toUpperCase() }))
                    }
                    placeholder="LM"
                    className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                               bg-background-main text-text-primary font-sans text-sm
                               focus:outline-2 focus:outline-primary-main"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-text-primary text-sm font-medium font-sans">
                  Nombre <span className="text-secondary-main">*</span>
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="LA MERCED"
                  className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                             bg-background-main text-text-primary font-sans text-sm
                             focus:outline-2 focus:outline-primary-main"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-text-primary text-sm font-medium font-sans">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  value={form.observations}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, observations: e.target.value }))
                  }
                  placeholder="Opcional"
                  className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                             bg-background-main text-text-primary font-sans text-sm
                             focus:outline-2 focus:outline-primary-main resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-sans text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.checked }))
                  }
                  className="size-4 accent-primary-main"
                />
                Unidad operativa activa
              </label>

              {formError && (
                <p className="text-sm font-sans text-secondary-main">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                  resetForm();
                }}
                disabled={submitting}
                className="px-4 py-2 rounded-md font-sans font-bold text-sm
                           bg-background-main outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary
                           hover:bg-primary-states-hover-main transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={editing ? handleSubmitEdit : handleSubmitCreate}
                disabled={submitting}
                className="px-4 py-2 rounded-md font-sans font-bold text-sm
                           bg-primary-main text-text-invert-primary hover:bg-primary-light transition-colors
                           disabled:opacity-60"
              >
                {submitting
                  ? 'Guardando…'
                  : editing
                    ? 'Guardar cambios'
                    : 'Crear unidad operativa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminación ───────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Eliminar unidad operativa"
        message="¿Seguro que deseas eliminar esta unidad operativa? La acción no se puede deshacer y fallará si tiene miembros o sectores asociados."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}