// src/components/AudioRecorder.js
import React, { useState, useEffect, useRef } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';

// MUI icons
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MicIcon from '@mui/icons-material/Mic';
import CloseIcon from '@mui/icons-material/Close';

// MUI components
import { Menu, MenuItem, IconButton, Button, CircularProgress } from '@mui/material';

// Our CSS
import '../styles/AudioRecorder.css';

// Our API calls
import { uploadChunk, mergeChunks, deleteAudio } from '../api';

function AudioRecorder({ sessionData, fetchSessionDetails, onStatusUpdate }) {
  // 'idle' | 'recording' | 'paused' | 'transcribing' | 'done'
  const [status, setStatus] = useState('idle');

  // Mic recorder, waveform, etc.
  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const waveformStreamRef = useRef(null);
  const animationFrameId = useRef(null);
  const canvasRef = useRef(null);

  // Timer
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const [timerDisplay, setTimerDisplay] = useState('00:00');

  // Device selection
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [micMenuAnchor, setMicMenuAnchor] = useState(null);

  // Transcription modal (for mic select, if needed)
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);

  // ─────────────────────────────────────────────────────────────────────
  //  1) Enumerate & filter out “default” duplicates, and pick one to show as selected
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const inputs = devices.filter((d) => d.kind === 'audioinput');

      // Check if there's a deviceId === 'default'
      const defaultDevice = inputs.find((d) => d.deviceId === 'default');

      // Build a filtered list of real devices, omitting the explicit "default" item
      const filteredDevices = [];
      const seenLabels = new Set();

      inputs.forEach((device) => {
        if (device.deviceId === 'default') return;
        if (!seenLabels.has(device.label)) {
          seenLabels.add(device.label);
          filteredDevices.push(device);
        }
      });

      // If a default device exists, try to match it; otherwise, pick the first available.
      let chosenDeviceId = '';
      if (defaultDevice) {
        const normalizedDefaultLabel = defaultDevice.label.replace(/^default\s*-\s*/i, '').trim();
        const match = filteredDevices.find((d) => d.label.endsWith(normalizedDefaultLabel));
        if (match) {
          chosenDeviceId = match.deviceId;
        }
      }
      if (!chosenDeviceId && filteredDevices.length > 0) {
        chosenDeviceId = filteredDevices[0].deviceId;
      }

      setAudioDevices(filteredDevices);
      setSelectedDeviceId(chosenDeviceId);
    })
    .catch((err) => console.error('Enumerate devices error:', err));
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  //  2) On session load, set status
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionData?.transcription_text) {
      setStatus('done');
    } else {
      setStatus('idle');
    }
    setAccumulatedTime(0);
    setTimerDisplay('00:00');
  }, [sessionData?.session_id, sessionData?.transcription_text]);

  // ─────────────────────────────────────────────────────────────────────
  //  3) If done and audio_file_path exists => delete that file on server
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'done' && sessionData?.transcription_text && sessionData?.audio_file_path) {
      deleteAudio(sessionData.session_id)
        .then(() => console.log('Audio file deleted on server.'))
        .catch((err) => console.error('Error deleting audio:', err));
    }
  }, [status, sessionData?.transcription_text, sessionData?.audio_file_path, sessionData?.session_id]);

  // ─────────────────────────────────────────────────────────────────────
  //  4) Timer runs only when recording
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let intervalId;
    if (status === 'recording') {
      const startTime = Date.now();
      setRecordingStartTime(startTime);
      intervalId = setInterval(() => {
        const now = Date.now();
        const totalMs = accumulatedTime + (now - startTime);
        updateTimerDisplay(totalMs);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, accumulatedTime]);

  // ─────────────────────────────────────────────────────────────────────
  //  5) Record control: start, pause, resume, stop
  // ─────────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      setStatus('recording');
      onStatusUpdate?.('Recording...');

      if (!waveformStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          },
        });
        waveformStreamRef.current = stream;

        // Set up audio context for waveform
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        drawWaveform();
      }

      // Start mic-recorder
      const newRecorder = new MicRecorder({ bitRate: 64 });
      recorderRef.current = newRecorder;
      await newRecorder.start();
    } catch (err) {
      console.error('Error starting recording:', err);
      setStatus('idle');
      onStatusUpdate?.('Microphone error.');
    }
  };

  const pauseRecording = async () => {
    if (!recorderRef.current) return;
    try {
      const now = Date.now();
      const totalMs = accumulatedTime + (now - recordingStartTime);
      setAccumulatedTime(totalMs);
      updateTimerDisplay(totalMs);

      // Stop mic-recorder => get Mp3 blob => upload chunk
      const [, blob] = await recorderRef.current.stop().getMp3();
      recorderRef.current = null;
      onStatusUpdate?.('Uploading partial...');
      await uploadChunk(sessionData.session_id, blob);
      onStatusUpdate?.('Partial saved. Paused.');
      setStatus('paused');
    } catch (err) {
      console.error('Error pausing:', err);
    }
  };

  const resumeRecording = async () => {
    try {
      setStatus('recording');
      onStatusUpdate?.('Resumed...');
      setRecordingStartTime(Date.now());

      const newRecorder = new MicRecorder({ bitRate: 64 });
      recorderRef.current = newRecorder;
      await newRecorder.start();
    } catch (err) {
      console.error('Error resuming:', err);
    }
  };

  const stopRecording = async () => {
    try {
      setStatus('transcribing');
      onStatusUpdate?.('Finalizing last chunk...');

      if (recorderRef.current) {
        const now = Date.now();
        const totalMs = accumulatedTime + (now - recordingStartTime);
        setAccumulatedTime(totalMs);
        updateTimerDisplay(totalMs);

        const [, blob] = await recorderRef.current.stop().getMp3();
        recorderRef.current = null;
        await uploadChunk(sessionData.session_id, blob);
      }

      // Stop waveform
      if (waveformStreamRef.current) {
        waveformStreamRef.current.getTracks().forEach((track) => track.stop());
        waveformStreamRef.current = null;
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }

      onStatusUpdate?.('Merging chunks...');
      await mergeChunks(sessionData.session_id);

      // Re-fetch session => get final transcription
      if (fetchSessionDetails) {
        await fetchSessionDetails(sessionData.session_id);
      }

      onStatusUpdate?.('Transcription complete');
      setStatus('done');
    } catch (err) {
      console.error('Error stopping recording:', err);
      setStatus('idle');
      onStatusUpdate?.('Error during processing.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  //  6) Waveform drawing
  // ─────────────────────────────────────────────────────────────────────
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArr = dataArrayRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    analyser.getByteFrequencyData(dataArr);

    const barColor = (status === 'paused') ? 'red' : '#22C197';
    ctx.fillStyle = barColor;

    const bufferLength = analyser.frequencyBinCount;
    const barWidth = canvas.width / bufferLength;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArr[i] / 255) * canvas.height;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    }

    animationFrameId.current = requestAnimationFrame(drawWaveform);
  };

  // ─────────────────────────────────────────────────────────────────────
  //  7) Timer helper
  // ─────────────────────────────────────────────────────────────────────
  const updateTimerDisplay = (msVal) => {
    const totalSeconds = Math.floor(msVal / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    setTimerDisplay(`${mm}:${ss}`);
  };

  // ─────────────────────────────────────────────────────────────────────
  //  8) Render the main (Start/Stop/Resume/Transcribing/Done) button
  // ─────────────────────────────────────────────────────────────────────

  // Determine if transcription is complete
  const transcriptionComplete = Boolean(sessionData?.transcription_text);

  const renderMainButton = () => {
    if (status === 'idle') {
      return (
        <Button onClick={startRecording} variant="outlined" className="bubble-button">
          <FiberManualRecordIcon className="record-icon" />
          <div className="bubble-label">START REC</div>
        </Button>
      );
    }
    if (status === 'recording') {
      return (
        <Button onClick={stopRecording} variant="outlined" className="bubble-button">
          <StopIcon className="stop-icon" />
          <div className="bubble-label">STOP REC</div>
        </Button>
      );
    }
    if (status === 'paused') {
      return (
        <Button onClick={resumeRecording} variant="outlined" className="bubble-button">
          <PlayCircleIcon style={{ color: 'green' }} />
          <div className="bubble-label">RESUME</div>
        </Button>
      );
    }
    if (status === 'transcribing') {
      return (
        <Button variant="outlined" disabled className="bubble-button">
          <CircularProgress size={24} />
          <div className="bubble-label">Transcribing</div>
        </Button>
      );
    }
    // 'done'
    return (
      <Button variant="outlined" disabled className="bubble-button">
        <CheckCircleIcon className="done-icon" />
        <div className="bubble-label">COMPLETE</div>
      </Button>
    );
  };

  // ─────────────────────────────────────────────────────────────────────
  //  9) Conditional buttons for pause and mic select
  // ─────────────────────────────────────────────────────────────────────
  const showPauseButton = (status === 'recording');
  const showTranscriptionButton = (
    status === 'done' && sessionData?.transcription_text
  );

  // ─────────────────────────────────────────────────────────────────────
  //  10) Render
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="audio-recorder-wrapper">
      {/* Row 1 */}
      <div className="audio-recorder-row1">
        <div className="main-button-slot">
          {renderMainButton()}
        </div>

        {showPauseButton && (
          <div className="pause-button-slot">
            <IconButton onClick={pauseRecording}>
              <PauseIcon className="audio-icon pause-button-icon" />
            </IconButton>
          </div>
        )}
        <div className='rec-col1'>
          {/* Timer is shown only when transcription is NOT complete */}
          {!transcriptionComplete && (
            <div className={`timer-display ${status === 'paused' ? 'paused' : ''}`}>
              {timerDisplay}
            </div>
          )}
          <div className="mic-select-container">
            <Button
              variant="outlined"
              className={`mic-select-button ${status === 'done' ? 'done' : ''}`}
              onClick={(e) => setMicMenuAnchor(e.currentTarget)}
              disabled={status === 'recording' || status === 'paused' || status === 'transcribing' || transcriptionComplete}
            >
              <MicIcon style={{ color: transcriptionComplete ? 'gray' : (status === 'done' ? 'gray' : 'inherit') }} />
              <KeyboardArrowDownIcon />
            </Button>
            <Menu
              anchorEl={micMenuAnchor}
              open={Boolean(micMenuAnchor)}
              onClose={() => setMicMenuAnchor(null)}
              PaperProps={{ style: { maxHeight: 300, minWidth: 200, fontSize: '0.85rem' } }}
            >
              {audioDevices.map((device) => (
                <MenuItem
                  key={device.deviceId}
                  onClick={() => {
                    setSelectedDeviceId(device.deviceId);
                    setMicMenuAnchor(null);
                  }}
                  sx={{
                    backgroundColor:
                      device.deviceId === selectedDeviceId ? '#e8f4fc' : 'transparent',
                    '&:hover': {
                      backgroundColor:
                        device.deviceId === selectedDeviceId ? '#d0e8f8' : '#f5f5f5',
                    },
                  }}
                >
                  {device.label || `Mic (${device.deviceId.slice(0, 4)})`}
                  {device.deviceId === selectedDeviceId && (
                    <CheckCircleIcon style={{ marginLeft: 'auto', color: '#22C197' }} />
                  )}
                </MenuItem>
              ))}
            </Menu>
          </div>
        </div>

        <div className='rec-col2'>
          <div className='waveform-container'>
            {/* Waveform is shown when idle, recording, or paused */}
            {(status === 'recording' || status === 'paused' || status === 'idle') && (
              <canvas
                ref={canvasRef}
                className="waveform-canvas"
                width={50}
                height={25}
              />
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default AudioRecorder;
