/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Server, Key, Terminal } from 'lucide-react';

interface FirebaseSetupErrorProps {
  missingVars: string[];
}

export const FirebaseSetupError: React.FC<FirebaseSetupErrorProps> = ({ missingVars }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl max-w-xl w-full p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Firebase Backend Configuration Required</h1>
            <p className="text-sm text-slate-400 mt-0.5">Missing environment variables in <code>.env</code></p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            Missing or unconfigured variables:
          </p>
          <ul className="space-y-1">
            {missingVars.map((v) => (
              <li key={v} className="text-xs font-mono text-red-400 bg-red-950/40 px-2 py-1 rounded border border-red-900/50">
                {v}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p className="flex items-center gap-2 font-semibold text-white">
            <Terminal className="w-4 h-4 text-[#228B22]" />
            Quick Setup Instructions:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-400">
            <li>Create or verify a <code>.env</code> file in the applet root directory.</li>
            <li>Copy the credentials from <code>.env.example</code> into <code>.env</code>.</li>
            <li>Restart the application server or refresh the browser to connect to Firestore and Firebase Auth.</li>
          </ol>
        </div>

        <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Sappy Stationary POS</span>
          <span>Status: 503 Backend Config Error</span>
        </div>
      </div>
    </div>
  );
};
