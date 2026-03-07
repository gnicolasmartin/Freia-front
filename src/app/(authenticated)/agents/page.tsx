"use client";

import { useState } from "react";
import { Bot, Plus } from "lucide-react";
import { useAgents } from "@/providers/AgentsProvider";
import { useAuditLog } from "@/providers/AuditLogProvider";
import AgentModal from "@/components/agents/AgentModal";
import AgentCard from "@/components/agents/AgentCard";
import type { Agent, AgentStatus } from "@/types/agent";

export default function AgentsPage() {
  const { agents, deleteAgent, updateAgent } = useAgents();
  const { addEntry } = useAuditLog();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const handleNewAgent = () => {
    setEditingAgent(null);
    setIsModalOpen(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setIsModalOpen(true);
  };

  const handleDeleteAgent = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    if (confirm(`¿Eliminar el agente "${agent.name}"? Esta acción no se puede deshacer.`)) {
      deleteAgent(id);
    }
  };

  /** Quick status transition from the card — validates transition and audits the change. */
  const handleStatusChange = (agent: Agent, newStatus: AgentStatus) => {
    if (agent.status === newStatus) return;
    updateAgent(agent.id, { status: newStatus });
    addEntry({
      type: "agent_status_change",
      agentId: agent.id,
      agentName: agent.name,
      previousStatus: agent.status,
      newStatus,
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAgent(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Agentes</h1>
          <p className="text-slate-400 mt-1">
            Configura y administra tus agentes de IA
          </p>
        </div>
        <button
          onClick={handleNewAgent}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
        >
          <Plus className="size-5" />
          <span>Nuevo Agente</span>
        </button>
      </div>

      {/* Agent Grid or Empty State */}
      {agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleEditAgent}
              onDelete={handleDeleteAgent}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 py-16 backdrop-blur-sm">
          <Bot className="size-12 text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            No hay agentes configurados
          </h2>
          <p className="text-slate-400 text-center max-w-md mb-6">
            Crea tu primer agente de IA y asígnalo a un flujo para comenzar a
            automatizar conversaciones con tus clientes.
          </p>
          <button
            onClick={handleNewAgent}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#dd7430] text-white font-medium hover:bg-orange-600 transition-colors"
          >
            <Plus className="size-5" />
            <span>Crear primer agente</span>
          </button>
        </div>
      )}

      {/* Modal */}
      <AgentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingAgent={editingAgent}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
