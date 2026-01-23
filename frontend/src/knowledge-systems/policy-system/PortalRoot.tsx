// Policy Portal Root - Complete Isolation
// Read-only, no editor imports, no shared components

import React from 'react';
import { useParams } from 'react-router-dom';
import { PolicySystem } from './model';
import { loadPublished } from './service';

export function PolicyPortalRoot({ id }: { id: string }) {
  // STRICT: Only load published data by ID, no draft access
  const system = loadPublished(id);

  if (!system) {
    throw new Error(`Policy system ${id} not found or not published`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-12 h-12 border-2 border-amber-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  const publishedContent = system.publishedContent!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-slate-900/80 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/25">
              <span className="text-4xl">📋</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                {publishedContent.title}
              </h1>
              <p className="text-amber-100/80 text-xl leading-relaxed">{publishedContent.description}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-8">
            {publishedContent.effectiveDate && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-xl">
                <span className="text-amber-400 text-sm">📅</span>
                <span className="text-amber-100 text-sm font-medium">
                  Effective: {new Date(publishedContent.effectiveDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {publishedContent.jurisdiction && (
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-xl">
                <span className="text-amber-400 text-sm">⚖️</span>
                <span className="text-amber-100 text-sm font-medium">
                  Jurisdiction: {publishedContent.jurisdiction}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {publishedContent.policies.map((policy, index) => (
            <div key={policy.id} className="border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden">
              <div className="p-6 border-b border-amber-500/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">{index + 1}</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-100 to-white bg-clip-text text-transparent mb-2">{policy.title}</h3>
                      {policy.category && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-200 border border-amber-500/30">
                          {policy.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-amber-200/60 font-medium">
                    Updated {new Date(policy.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="px-8 pb-8">
                <div className="prose prose-lg max-w-none">
                  {policy.content.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="mb-6 text-amber-50/90 leading-relaxed last:mb-0 text-lg">
                      {paragraph.split('\n').map((line, j) => (
                        <span key={j}>
                          {line}
                          {j < paragraph.split('\n').length - 1 && <br />}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}