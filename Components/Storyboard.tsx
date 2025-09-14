/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useRef, useState} from 'react';

export interface VideoClip {
  id: string;
  src: string;
  prompt: string;
}

interface StoryboardProps {
  clips: VideoClip[];
  setClips: (clips: VideoClip[]) => void;
}

export function Storyboard({clips, setClips}: StoryboardProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  if (clips.length === 0) {
    return null;
  }

  const handleDelete = (index: number) => {
    setClips(clips.filter((_, i) => i !== index));
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (index: number) => {
    dragOverIndex.current = index;
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex.current !== null) {
      const newClips = [...clips];
      const draggedItem = newClips.splice(draggedIndex, 1)[0];
      newClips.splice(dragOverIndex.current, 0, draggedItem);
      setClips(newClips);
    }
    setDraggedIndex(null);
    dragOverIndex.current = null;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  return (
    <div className="storyboard-wrapper">
      <div className="storyboard">
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            className="storyboard-clip"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}>
            <video src={clip.src} muted playsInline />
            <button
              className="storyboard-clip-delete"
              onClick={() => handleDelete(index)}>
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
