"use client";

import { create } from "zustand";
import type { Workspace, Project, ProjectFile } from "@manticode/shared";
import { api } from "@/lib/api";

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  projects: Project[];
  activeProject: Project | null;
  files: ProjectFile[];
  activeFile: ProjectFile | null;

  fetchWorkspaces: () => Promise<void>;
  ensureDefaultProject: () => Promise<Project | null>;
  setActiveWorkspace: (ws: Workspace) => void;
  fetchProjects: (workspaceId: string) => Promise<void>;
  setActiveProject: (p: Project) => void;
  fetchFiles: (projectId: string) => Promise<void>;
  setActiveFile: (f: ProjectFile | null) => void;
  createProject: (wid: string, data: { name: string; description?: string; language?: string }) => Promise<Project>;
  createFile: (pid: string, data: { path: string; content: string; language?: string }) => Promise<ProjectFile>;
  updateFile: (fid: string, content: string) => Promise<ProjectFile>;
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  projects: [],
  activeProject: null,
  files: [],
  activeFile: null,

  fetchWorkspaces: async () => {
    const workspaces = await api.get<Workspace[]>("/api/workspaces");
    const active = workspaces[0] ?? null;
    set({ workspaces, activeWorkspace: active });
    if (active) await get().fetchProjects(active.id);
    else set({ projects: [], activeProject: null, files: [], activeFile: null });
  },

  ensureDefaultProject: async () => {
    let { activeWorkspace, projects } = get();
    if (!activeWorkspace) {
      await get().fetchWorkspaces();
      activeWorkspace = get().activeWorkspace;
      projects = get().projects;
    }
    if (!activeWorkspace) return null;
    if (projects.length > 0) return projects[0];
    return get().createProject(activeWorkspace.id, {
      name: "General",
      description: "Default project",
      language: "typescript",
    });
  },

  setActiveWorkspace: (ws) => {
    set({ activeWorkspace: ws, projects: [], activeProject: null, files: [], activeFile: null });
    get().fetchProjects(ws.id);
  },

  fetchProjects: async (wid) => {
    const projects = await api.get<Project[]>(`/api/workspaces/${wid}/projects`);
    set({ projects });
  },

  setActiveProject: (p) => {
    set({ activeProject: p, files: [], activeFile: null });
    get().fetchFiles(p.id);
  },

  fetchFiles: async (pid) => {
    const files = await api.get<ProjectFile[]>(`/api/projects/${pid}/files`);
    set({ files });
  },

  setActiveFile: (f) => set({ activeFile: f }),

  createProject: async (wid, data) => {
    const project = await api.post<Project>(`/api/workspaces/${wid}/projects`, data);
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  createFile: async (pid, data) => {
    const file = await api.post<ProjectFile>(`/api/projects/${pid}/files`, data);
    set((s) => ({ files: [...s.files, file] }));
    return file;
  },

  updateFile: async (fid, content) => {
    const file = await api.put<ProjectFile>(`/api/files/${fid}`, { content });
    set((s) => ({
      files: s.files.map((f) => (f.id === fid ? file : f)),
      activeFile: s.activeFile?.id === fid ? file : s.activeFile,
    }));
    return file;
  },
}));
