"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Agent, AgentFormData } from "@/types/agent";
import { EMPTY_AGENT_FORM } from "@/types/agent";
import { getSessionCompanyId } from "@/lib/get-session-company";

interface AgentsContextType {
  agents: Agent[];
  isLoading: boolean;
  createAgent: (data: AgentFormData) => Agent;
  updateAgent: (id: string, data: Partial<AgentFormData>) => Agent | null;
  deleteAgent: (id: string) => boolean;
  getAgent: (id: string) => Agent | undefined;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

const STORAGE_KEY = "freia_agents";

/** Migrate legacy agent shape to v2 schema */
function migrateAgent(raw: Record<string, unknown>): Agent {
  const now = new Date().toISOString();
  return {
    id: (raw.id as string) ?? crypto.randomUUID(),
    name: (raw.name as string) ?? "",
    description: (raw.description as string) ?? "",
    status: (raw.status as Agent["status"]) ?? "draft",
    channelScope:
      (raw.channelScope as Agent["channelScope"]) ??
      (raw.channel as Agent["channelScope"]) ??
      "web",
    flowId: (raw.flowId as string) ?? (raw.flow as string) ?? "",
    mode:
      (raw.mode as Agent["mode"]) ??
      ((raw.relationWithFlow as string) === "hibrido"
        ? "hybrid"
        : (raw.relationWithFlow as string) === "ai_guided"
        ? "ai-guided"
        : "flow-driven"),
    primaryObjective:
      (raw.primaryObjective as string) ?? (raw.objective as string) ?? "",
    kpiType:
      (raw.kpiType as string) ??
      (Array.isArray(raw.kpis) ? (raw.kpis as string[])[0] ?? "" : ""),
    kpiTarget: raw.kpiTarget as number | undefined,
    llmProvider: "openai",
    modelName: (raw.modelName as string) ?? "gpt-4o",
    temperature: typeof raw.temperature === "number" ? raw.temperature : 0.7,
    maxTokens: typeof raw.maxTokens === "number" ? raw.maxTokens : 1024,
    topP: typeof raw.topP === "number" ? raw.topP : 1,
    frequencyPenalty:
      typeof raw.frequencyPenalty === "number" ? raw.frequencyPenalty : 0,
    presencePenalty:
      typeof raw.presencePenalty === "number" ? raw.presencePenalty : 0,
    tone: (raw.tone as string) ?? EMPTY_AGENT_FORM.tone,
    responseLength:
      (raw.responseLength as string) ??
      (raw.length as string) ??
      EMPTY_AGENT_FORM.responseLength,
    emojiUsage:
      (raw.emojiUsage as string) ??
      (raw.emojis as string) ??
      EMPTY_AGENT_FORM.emojiUsage,
    language: (raw.language as string) ?? EMPTY_AGENT_FORM.language,
    policyScope: "inherited",
    allowOverride:
      typeof raw.allowOverride === "boolean" ? raw.allowOverride : false,
    createdAt: (raw.createdAt as string) ?? now,
    updatedAt: (raw.updatedAt as string) ?? now,
  };
}

export function AgentsProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, unknown>[];
        setAgents(parsed.map(migrateAgent));
      } catch {
        // ignore corrupted data
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    }
  }, [agents, isLoading]);

  const createAgent = (data: AgentFormData): Agent => {
    const now = new Date().toISOString();
    const newAgent: Agent = {
      id: crypto.randomUUID(),
      ...data,
      companyId: data.companyId ?? getSessionCompanyId(),
      createdAt: now,
      updatedAt: now,
    };
    setAgents((prev) => [...prev, newAgent]);
    return newAgent;
  };

  const updateAgent = (
    id: string,
    data: Partial<AgentFormData>
  ): Agent | null => {
    let updated: Agent | null = null;
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === id) {
          updated = {
            ...agent,
            ...data,
            updatedAt: new Date().toISOString(),
          };
          return updated;
        }
        return agent;
      })
    );
    return updated;
  };

  const deleteAgent = (id: string): boolean => {
    const exists = agents.some((a) => a.id === id);
    if (!exists) return false;
    setAgents((prev) => prev.filter((a) => a.id !== id));
    return true;
  };

  const getAgent = (id: string) => agents.find((a) => a.id === id);

  return (
    <AgentsContext.Provider
      value={{ agents, isLoading, createAgent, updateAgent, deleteAgent, getAgent }}
    >
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (context === undefined) {
    throw new Error("useAgents debe ser usado dentro de AgentsProvider");
  }
  return context;
}
