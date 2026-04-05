/**
 * AgentSetup — bot agent configuration for run setup.
 * Add/remove bots, assign behavior schemes from a dropdown,
 * import/export behavior JSON, and create new behaviors inline.
 */

import React, { useCallback, useState } from 'react';
import type { BotBehavior, MapDefinition } from '@bomberman65/shared';
import { createDefaultBehavior, BOT_BEHAVIOR_PRESETS } from '@bomberman65/shared';
import { BotBehaviorEditor } from './BotBehaviorEditor.js';

export type BotSlot = {
  id: string;
  behaviorId: string;
};

export type AgentSetupProps = {
  bots: BotSlot[];
  onBotsChange: (bots: BotSlot[]) => void;
  behaviors: BotBehavior[];
  onBehaviorsChange: (behaviors: BotBehavior[]) => void;
  currentMap: MapDefinition | null;
};

let slotCounter = 0;

export function AgentSetup({
  bots,
  onBotsChange,
  behaviors,
  onBehaviorsChange,
  currentMap,
}: AgentSetupProps) {
  const [, setEditingBehaviorId] = useState<string | null>(null);
  const [editingBehavior, setEditingBehavior] = useState<BotBehavior | null>(null);

  const botSpawns = currentMap?.spawns.filter((s) => s.kind === 'bot' || s.kind === 'generic') ?? [];
  const maxBots = botSpawns.length;

  const allBehaviors = [
    ...Object.values(BOT_BEHAVIOR_PRESETS),
    ...behaviors.filter((b) => !BOT_BEHAVIOR_PRESETS[b.id]),
  ];

  const handleAddBot = useCallback(() => {
    if (bots.length >= maxBots) return;
    onBotsChange([...bots, { id: `bot_${++slotCounter}`, behaviorId: 'default' }]);
  }, [bots, maxBots, onBotsChange]);

  const handleRemoveBot = useCallback(
    (id: string) => {
      onBotsChange(bots.filter((b) => b.id !== id));
    },
    [bots, onBotsChange],
  );

  const handleBehaviorChange = useCallback(
    (botId: string, behaviorId: string) => {
      onBotsChange(bots.map((b) => (b.id === botId ? { ...b, behaviorId } : b)));
    },
    [bots, onBotsChange],
  );

  const handleImportBehavior = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as BotBehavior;
        if (!imported.id || !imported.name) return;
        // Replace existing or add
        const existing = behaviors.findIndex((b) => b.id === imported.id);
        if (existing >= 0) {
          const updated = [...behaviors];
          updated[existing] = imported;
          onBehaviorsChange(updated);
        } else {
          onBehaviorsChange([...behaviors, imported]);
        }
      } catch {
        // silently ignore invalid files
      }
    };
    input.click();
  }, [behaviors, onBehaviorsChange]);

  const handleNewBehavior = useCallback(() => {
    const id = `custom_${Date.now()}`;
    const newBehavior: BotBehavior = { ...createDefaultBehavior(), id, name: 'New Behavior' };
    setEditingBehaviorId(id);
    setEditingBehavior(newBehavior);
  }, []);

  const handleSaveBehavior = useCallback(
    (behavior: BotBehavior) => {
      const existing = behaviors.findIndex((b) => b.id === behavior.id);
      if (existing >= 0) {
        const updated = [...behaviors];
        updated[existing] = behavior;
        onBehaviorsChange(updated);
      } else {
        onBehaviorsChange([...behaviors, behavior]);
      }
      setEditingBehaviorId(null);
      setEditingBehavior(null);
    },
    [behaviors, onBehaviorsChange],
  );

  const handleDeleteBehavior = useCallback(
    (id: string) => {
      onBehaviorsChange(behaviors.filter((b) => b.id !== id));
      // Reset any bots using this behavior
      onBotsChange(bots.map((b) => (b.behaviorId === id ? { ...b, behaviorId: 'default' } : b)));
      setEditingBehaviorId(null);
      setEditingBehavior(null);
    },
    [behaviors, bots, onBehaviorsChange, onBotsChange],
  );

  return (
    <div style={{ fontSize: 11 }}>
      {/* Spawn info */}
      <div style={{ color: '#888', marginBottom: 4 }}>
        Bot spawns: {maxBots} available ({bots.length} assigned)
      </div>

      {/* Bot slot list */}
      {bots.map((bot, i) => (
        <div
          key={bot.id}
          style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            marginBottom: 4,
            padding: '2px 4px',
            background: i < maxBots ? '#2a2a2a' : '#422',
            borderRadius: 3,
          }}
        >
          <span style={{ minWidth: 40, color: i < maxBots ? '#e0e0e0' : '#f66' }}>
            Bot {i + 1}
          </span>
          <select
            value={bot.behaviorId}
            onChange={(e) => handleBehaviorChange(bot.id, e.target.value)}
            style={{
              flex: 1,
              background: '#333',
              color: '#e0e0e0',
              border: '1px solid #555',
              borderRadius: 3,
              fontSize: 10,
              padding: '1px 2px',
            }}
          >
            {allBehaviors.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const b = allBehaviors.find((bh) => bh.id === bot.behaviorId);
              if (b) {
                setEditingBehaviorId(b.id);
                setEditingBehavior({ ...b });
              }
            }}
            style={smallBtnStyle}
            title="Edit behavior"
          >
            E
          </button>
          <button
            onClick={() => handleRemoveBot(bot.id)}
            style={{ ...smallBtnStyle, background: '#433' }}
            title="Remove bot"
          >
            X
          </button>
        </div>
      ))}
      {bots.length > maxBots && (
        <div style={{ color: '#f66', fontSize: 10, marginBottom: 4 }}>
          {bots.length - maxBots} bot(s) exceed available spawns and will not be placed.
        </div>
      )}

      {/* Add bot / actions */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          onClick={handleAddBot}
          disabled={bots.length >= maxBots}
          style={{
            ...smallBtnStyle,
            opacity: bots.length >= maxBots ? 0.5 : 1,
          }}
        >
          + Bot
        </button>
        <button onClick={handleNewBehavior} style={smallBtnStyle}>
          + Behavior
        </button>
        <button onClick={handleImportBehavior} style={smallBtnStyle}>
          Import
        </button>
      </div>

      {/* Inline behavior editor */}
      {editingBehavior && (
        <div
          style={{
            marginTop: 8,
            padding: 6,
            border: '1px solid #555',
            borderRadius: 4,
            background: '#1e1e1e',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#aaa' }}>
            Edit: {editingBehavior.name}
          </div>
          <BotBehaviorEditor
            behavior={editingBehavior}
            onChange={setEditingBehavior}
            onSave={handleSaveBehavior}
            onDelete={
              !BOT_BEHAVIOR_PRESETS[editingBehavior.id] ? handleDeleteBehavior : undefined
            }
          />
          <button
            onClick={() => {
              setEditingBehaviorId(null);
              setEditingBehavior(null);
            }}
            style={{ ...smallBtnStyle, marginTop: 4 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  padding: '1px 6px',
  fontSize: 10,
  background: '#343',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  cursor: 'pointer',
};
