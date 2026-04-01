/**
 * MapMetadata — name, description, tags inputs for map metadata.
 */

import React from 'react';

export type MapMetadataProps = {
  name: string;
  description: string;
  tags: string[];
  onNameChange: (name: string) => void;
  onDescriptionChange: (desc: string) => void;
  onTagsChange: (tags: string[]) => void;
};

export function MapMetadata({
  name,
  description,
  tags,
  onNameChange,
  onDescriptionChange,
  onTagsChange,
}: MapMetadataProps) {
  return (
    <div style={{ fontSize: 11, marginBottom: 8 }}>
      <label style={{ display: 'block', marginBottom: 4 }}>
        Name:
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          style={{ ...inputStyle, width: '100%', marginTop: 2 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 4 }}>
        Description:
        <input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          style={{ ...inputStyle, width: '100%', marginTop: 2 }}
        />
      </label>
      <label style={{ display: 'block' }}>
        Tags (comma-separated):
        <input
          type="text"
          value={tags.join(', ')}
          onChange={(e) =>
            onTagsChange(
              e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            )
          }
          style={{ ...inputStyle, width: '100%', marginTop: 2 }}
        />
      </label>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#2a2a2a',
  color: '#e0e0e0',
  border: '1px solid #555',
  borderRadius: 3,
  fontSize: 11,
  padding: '2px 4px',
};
