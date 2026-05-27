"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Member, MemberRole, CreateMemberBody, UpdateMemberBody } from "@vultra/types";
import { membersApi, ApiClientError } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

// ── Role badge ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Admin",
  professor: "Professor",
  rh: "RH",
  student: "Aluno",
};

const ROLE_COLORS: Record<MemberRole, string> = {
  admin: "bg-purple-100 text-purple-800",
  professor: "bg-blue-100 text-blue-800",
  rh: "bg-teal-100 text-teal-800",
  student: "bg-gray-100 text-gray-700",
};

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", ROLE_COLORS[role])}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ── Member form ────────────────────────────────────────────────────────────────

type MemberFormValues = {
  fullName: string;
  email: string;
  role: MemberRole;
  externalCode: string;
};

function MemberFormModal({
  member,
  onClose,
  onSaved,
}: {
  member?: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<MemberFormValues>({
    fullName: member?.fullName ?? "",
    email: member?.email ?? "",
    role: member?.role ?? "student",
    externalCode: member?.externalCode ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isEdit = !!member;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isEdit) {
        const body: UpdateMemberBody = {
          fullName: values.fullName || undefined,
          email: values.email || null,
          role: values.role,
          externalCode: values.externalCode || null,
        };
        await membersApi.update(member.id, body);
      } else {
        const body: CreateMemberBody = {
          fullName: values.fullName,
          email: values.email || undefined,
          role: values.role,
          externalCode: values.externalCode || undefined,
        };
        await membersApi.create(body);
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.code === "MEMBER_EXTERNAL_CODE_CONFLICT"
          ? "Código externo já está em uso por outro membro ativo."
          : `Erro: ${err.code}`);
      } else {
        setError("Ocorreu um erro inesperado.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Editar membro" : "Novo membro"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
            <input
              required
              minLength={2}
              maxLength={200}
              value={values.fullName}
              onChange={(e) => setValues({ ...values, fullName: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              maxLength={254}
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Papel *</label>
            <select
              required
              value={values.role}
              onChange={(e) => setValues({ ...values, role: e.target.value as MemberRole })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código externo <span className="text-gray-400 font-normal">(matrícula / RF)</span>
            </label>
            <input
              maxLength={50}
              value={values.externalCode}
              onChange={(e) => setValues({ ...values, externalCode: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Salvando..." : isEdit ? "Salvar" : "Criar membro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Deactivate confirmation ────────────────────────────────────────────────────

function DeactivateConfirm({
  member,
  onClose,
  onConfirm,
}: {
  member: Member;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Desativar membro</h2>
        <p className="text-sm text-gray-600 mb-5">
          Confirma a desativação de <strong>{member.fullName}</strong>?
          O membro perderá acesso imediatamente. Dados retidos conforme LGPD.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Desativar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<MemberRole | "">("");
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<Member | undefined>();
  const [deactivating, setDeactivating] = useState<Member | undefined>();
  const [offset, setOffset] = useState(0);
  const LIMIT = 25;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["members", { search, role: roleFilter, offset }],
    queryFn: () =>
      membersApi.list({
        search: search || undefined,
        role: roleFilter || undefined,
        limit: LIMIT,
        offset,
      }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => membersApi.deactivate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members"] });
      setDeactivating(undefined);
    },
  });

  function handleSaved() {
    void qc.invalidateQueries({ queryKey: ["members"] });
  }

  const members = data?.members ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Membros</h1>
          {total > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{total} membro{total !== 1 ? "s" : ""}</p>
          )}
        </div>
        <button
          onClick={() => { setEditMember(undefined); setShowForm(true); }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Novo membro
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Buscar por nome ou matrícula…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as MemberRole | ""); setOffset(0); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os papéis</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-500">Erro ao carregar membros.</div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">Nenhum membro encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">E-mail</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Papel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Criado em</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email ?? "—"}</td>
                  <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{m.externalCode ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(m.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditMember(m); setShowForm(true); }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDeactivating(m)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Desativar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {offset + 1}–{Math.min(offset + LIMIT, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Anterior
            </button>
            <button
              disabled={offset + LIMIT >= total}
              onClick={() => setOffset(offset + LIMIT)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <MemberFormModal
          member={editMember}
          onClose={() => { setShowForm(false); setEditMember(undefined); }}
          onSaved={handleSaved}
        />
      )}

      {deactivating && (
        <DeactivateConfirm
          member={deactivating}
          onClose={() => setDeactivating(undefined)}
          onConfirm={() => {
            deactivateMutation.mutate(deactivating.id);
          }}
        />
      )}
    </div>
  );
}
