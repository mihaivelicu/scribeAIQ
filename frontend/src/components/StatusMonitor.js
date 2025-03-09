// src/components/StatusMonitor.js
import React, { useState, useEffect } from 'react';

function StatusMonitor({ sessionData, isRecording, isTranscribing }) {
  /*
    status can be:
      'idle'         => "Record a session"
      'recording'    => "Recording in progress"
      'transcribing' => "Transcribing in progress"
      'done'         => "Transcription complete"
  */
  const [status, setStatus] = useState('idle');

  // If sessionData has transcription_text, we show "done"
  useEffect(() => {
    if (sessionData?.transcription_text) {
      setStatus('done');
    } else {
      // Otherwise, if isRecording or isTranscribing, keep those states
      // else fallback to 'idle'
      if (status !== 'recording' && status !== 'transcribing') {
        setStatus('idle');
      }
    }
    // We only re-run if sessionData changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData]);

  useEffect(() => {
    if (isRecording) {
      setStatus('recording');
    }
  }, [isRecording]);

  useEffect(() => {
    if (isTranscribing) {
      setStatus('transcribing');
    }
  }, [isTranscribing]);

  // function to get user-friendly label
  const getLabel = () => {
    switch (status) {
      case 'idle':
        return 'Record a session';
      case 'recording':
        return 'Recording in progress';
      case 'transcribing':
        return 'Transcribing in progress';
      case 'done':
        return 'Transcription complete';
      default:
        return '';
    }
  };

  return (
    <div className="status-monitor">
      <span className="status-tag">{getLabel()}</span>
    </div>
  );
}

export default StatusMonitor;
