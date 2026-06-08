"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";

export interface MemberView {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
  isSelf: boolean;
}

export interface InviteView {
  id: string;
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  expiresAt: string;
  expired: boolean;
}

const ROLE_RANK: Record<string, number> = { member: 1, admin: 2, owner: 3 };

function roleVariant(role: string): BadgeProps["variant"] {
  if (role === "owner") return "default";
  if (role === "admin") return "info";
  return "secondary";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function MembersManager({
  orgId,
  myRole,
  initialMembers,
  initialInvites,
}: {
  orgId: string;
  myRole: string;
  initialMembers: MemberView[];
  initialInvites: InviteView[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const canManage = (ROLE_RANK[myRole] ?? 0) >= ROLE_RANK.admin;
  const isOwner = myRole === "owner";

  const inviteLinkFor = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/invitations/${token}`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLastLink(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send invitation");
        return;
      }
      setLastLink(data.inviteUrl);
      setEmail("");
      // Refresh pending invites.
      setInvites((prev) => [
        {
          id: data.id,
          email: data.email,
          role: data.role,
          token: data.token,
          invitedBy: "You",
          expiresAt: data.expiresAt,
          expired: false,
        },
        ...prev.filter((i) => i.email !== data.email),
      ]);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const revokeInvite = async (id: string) => {
    const res = await fetch(`/api/orgs/${orgId}/invitations/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  const changeRole = async (membershipId: string, newRole: string) => {
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to change role");
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.membershipId === membershipId ? { ...m, role: newRole } : m)),
    );
  };

  const removeMember = async (membershipId: string) => {
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/members/${membershipId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to remove member");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.membershipId !== membershipId));
  };

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Members table */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Members</h3>
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Joined</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.membershipId} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{m.name ?? m.email}</div>
                    {m.name ? (
                      <div className="text-xs text-neutral-500">{m.email}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {isOwner && !m.isSelf ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.membershipId, e.target.value)}
                        className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    ) : (
                      <Badge variant={roleVariant(m.role)}>{m.role}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{fmtDate(m.joinedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {m.isSelf ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(m.membershipId)}
                      >
                        Leave
                      </Button>
                    ) : canManage ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(m.membershipId)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending invitations */}
      {canManage ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">
            Pending invitations
          </h3>
          {invites.length === 0 ? (
            <p className="text-sm text-neutral-500">No pending invitations.</p>
          ) : (
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{inv.email}</span>{" "}
                    <Badge variant={roleVariant(inv.role)}>{inv.role}</Badge>
                    {inv.expired ? (
                      <Badge variant="high" className="ml-2">
                        expired
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copy(inviteLinkFor(inv.token), inv.id)}
                    >
                      {copied === inv.id ? "Copied!" : "Copy invite link"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeInvite(inv.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Invite form */}
      {canManage ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-neutral-700">
            Invite a member
          </h3>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "member")}
                  className="block rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </form>
          {lastLink ? (
            <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              <p className="mb-1 font-medium">Invitation created. Share this link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs">
                  {lastLink}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copy(lastLink, "last")}
                >
                  {copied === "last" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
