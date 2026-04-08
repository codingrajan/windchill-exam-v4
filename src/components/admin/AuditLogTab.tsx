import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { AuditLogEntry } from '../../types/index';

export default function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    void getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc')))
      .then((snap) => {
        const next: AuditLogEntry[] = [];
        snap.forEach((entry) => next.push({ ...(entry.data() as AuditLogEntry), id: entry.id }));
        setLogs(next);
      })
      .catch((error) => console.error('Audit log fetch error:', error))
      .finally(() => setLoading(false));
  }, []);

  const actions = [...new Set(logs.map((log) => log.action))].sort();
  const entityTypes = [...new Set(logs.map((log) => log.entityType))].sort();
  const filteredLogs = logs.filter((log) =>
    (!actionFilter || log.action === actionFilter) &&
    (!entityFilter || log.entityType === entityFilter),
  );

  return (
    <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-100">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          Audit Trail
        </p>
      </div>

      <div className="px-5 py-4 border-b border-zinc-100 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"
          >
            <option value="">All Actions</option>
            {actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"
          >
            <option value="">All Entities</option>
            {entityTypes.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 px-5 text-center text-sm font-medium text-zinc-400">
          No audit entries match the current filters.
        </div>
      ) : (
        <div className="divide-y divide-zinc-50 max-h-[620px] overflow-y-auto">
          {filteredLogs.map((log) => (
            <div key={log.id} className="px-5 py-4 hover:bg-zinc-50/60 transition-colors">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-semibold text-zinc-800">{log.action}</span>
                    <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                      {log.entityType}
                    </span>
                    {log.entityId && (
                      <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                        {log.entityId}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-2">
                    {log.actorEmail ?? 'system'} · {new Date(log.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="whitespace-pre-wrap break-words rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-[11px] text-zinc-600">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
