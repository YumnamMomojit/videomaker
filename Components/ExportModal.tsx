/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useState} from 'react';
import {useToasts} from 'tldraw';

interface ExportModalProps {
  onClose: () => void;
  clipCount: number;
}

export function ExportModal({onClose, clipCount}: ExportModalProps) {
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [isExporting, setIsExporting] = useState(false);
  const {addToast} = useToasts();

  const handleExport = () => {
    setIsExporting(true);
    // Placeholder for actual video merging logic
    console.log(`Exporting ${clipCount} clips at ${selectedQuality}`);
    setTimeout(() => {
      addToast({
        title: 'Export Started',
        severity: 'info',
        description:
          'Video merging is a backend process and is not implemented in this demo.',
      });
      setIsExporting(false);
      onClose();
    }, 2000);
  };

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div
        className="export-modal-content"
        onClick={(e) => e.stopPropagation()}>
        <h2>Combine &amp; Export Video</h2>
        <p>
          {clipCount} {clipCount > 1 ? 'clips' : 'clip'} in storyboard.
        </p>

        <div className="export-quality-selector">
          <button
            className={selectedQuality === '720p' ? 'selected' : ''}
            onClick={() => setSelectedQuality('720p')}>
            720p
          </button>
          <button
            className={selectedQuality === '1080p' ? 'selected' : ''}
            onClick={() => setSelectedQuality('1080p')}>
            1080p
          </button>
          <button
            className={selectedQuality === '4K' ? 'selected' : ''}
            onClick={() => setSelectedQuality('4K')}>
            4K
          </button>
        </div>

        <div className="export-modal-actions">
          <button className="export-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="export-modal-submit"
            onClick={handleExport}
            disabled={isExporting}>
            {isExporting ? 'Exporting...' : `Export (${selectedQuality})`}
          </button>
        </div>
      </div>
    </div>
  );
}
