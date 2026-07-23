"use client";

import { api } from "./api";
import type { StepStatus, Prio, Quadrant, NodeKind } from "./types";

export function addNode(slug: string, input: { kind: NodeKind; title: string; parentId?: string | null }) {
  return api.post(`/api/boards/${slug}/nodes`, input);
}

export interface PatchNodeInput {
  status?: StepStatus;
  title?: string;
  reason?: string;
  due?: string | null;
  prio?: Prio | null;
  owner?: string | null;
  quadrant?: Quadrant | null;
  archived?: boolean;
  blocker?: { description: string; unblockPlan?: string };
}

export function patchNode(slug: string, nodeId: string, input: PatchNodeInput) {
  return api.patch(`/api/boards/${slug}/nodes/${nodeId}`, input);
}

export function addNote(slug: string, nodeId: string, body: string) {
  return api.post(`/api/boards/${slug}/nodes/${nodeId}/notes`, { body });
}
