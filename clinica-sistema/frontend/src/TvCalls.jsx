import { useEffect, useState } from "react";
import { getPublicCalls } from "./api";

export default function TvCalls() {
  const [calls, setCalls] = useState([]);
  const [error, setError] = useState(false);

  // Função para buscar chamados sem precisar de login (pública para a TV)
  const fetchCalls = async () => {
    try {
      const data = await getPublicCalls();
      if (Array.isArray(data)) {
        setCalls(data);
      }
    } catch (err) {
      setError(true);
    }
  };

  useEffect(() => {
    fetchCalls();
    // Atualiza a lista a cada 5 segundos automaticamente na TV
    const interval = setInterval(fetchCalls, 5000);
    return () => clearInterval(interval);
  }, []);

  const activeCall = calls.find((item) => item.status === "chamado" && item.destination_type === "Consultório") || calls.find((item) => item.status === "chamado") || null;
  const waitingCalls = calls.filter((item) => item.status === "aguardando");
  const previousCalls = calls.filter((item) => item.id !== activeCall?.id).slice(0, 5);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-900 p-8 text-white select-none">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold tracking-wider text-blue-400">CLÍNICA MÉDICA — CHAMADOS</h1>
        <div className="text-xl font-medium text-slate-400">
          {new Date().toLocaleDateString()} — {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
        {activeCall ? (
          <div className="w-full max-w-4xl rounded-3xl bg-blue-600 p-12 text-center shadow-2xl transition-all duration-300 animate-pulse">
            <span className="text-2xl font-semibold uppercase tracking-widest text-blue-200">Senha Chamada</span>
            <div className="my-6 text-7xl font-extrabold tracking-tight">{activeCall.ticket_code}</div>
            <div className="text-2xl font-semibold text-blue-100">{activeCall.patient_name}</div>
            <div className="mt-3 text-lg uppercase tracking-[0.25em] text-blue-200">Destino: {activeCall.destination_type}</div>
            <div className="inline-block rounded-2xl bg-white px-8 py-4 text-4xl font-bold text-blue-900 shadow-inner">
              {activeCall.destination_label}
            </div>
          </div>
        ) : (
          <div className="text-3xl font-medium text-slate-500">Aguardando novos chamados...</div>
        )}

        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl bg-slate-800 p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-slate-300">Aguardando Atendimento</h2>
            <div className="space-y-3">
              {waitingCalls.length > 0 ? (
                waitingCalls.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-700/50 p-4 text-xl">
                    <div>
                      <span className="font-bold text-white">{c.ticket_code} - {c.patient_name}</span>
                      <p className="mt-1 text-sm uppercase tracking-[0.2em] text-slate-400">Status: {c.status}</p>
                    </div>
                    <span className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-amber-900">{c.destination_label}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Nenhum paciente aguardando no momento.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-800 p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-slate-300">Últimas Senhas</h2>
          <div className="space-y-3">
            {previousCalls.length > 0 ? (
              previousCalls.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-slate-700/50 p-4 text-xl">
                  <div>
                    <span className="font-bold text-white">{c.ticket_code} - {c.patient_name}</span>
                    <p className="mt-1 text-sm uppercase tracking-[0.2em] text-slate-400">{c.status}</p>
                  </div>
                  <span className="rounded-lg bg-slate-600 px-4 py-1 font-semibold text-blue-300">{c.destination_label}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500">Nenhum histórico recente.</p>
            )}
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
