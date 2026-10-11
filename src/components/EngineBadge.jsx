import React from 'react';
import { Cloud, Cpu, Loader2 } from 'lucide-react';

/**
 * Shows which engine produced the plan on screen:
 * [AWS Cloud Live: Claude …] for Amazon Bedrock, [Calibrated Local Engine] otherwise.
 */
export default function EngineBadge({ engine, synthesizing }) {
  if (synthesizing) {
    return (
      <span className="engine-badge synthesizing" title="Claude on Amazon Bedrock is generating a plan; the calibrated plan is shown meanwhile">
        <Loader2 size={11} className="spin-icon" />
        Bedrock synthesizing…
      </span>
    );
  }

  if (engine?.provider === 'amazon-bedrock') {
    return (
      <span className="engine-badge cloud" title={`${engine.modelId} · ${engine.region}`}>
        <Cloud size={11} />
        [AWS Cloud Live: {engine.modelName}]
      </span>
    );
  }

  return (
    <span className="engine-badge local" title={engine?.fallbackReason || 'Deterministic NIOSH 2016-106 planner running without AWS'}>
      <Cpu size={11} />
      [Calibrated Local Engine]
    </span>
  );
}
