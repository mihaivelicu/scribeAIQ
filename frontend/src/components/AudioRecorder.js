// src/components/AudioRecorder.js
import React, { useState, useEffect, useRef } from 'react';
import MicRecorder from 'mic-recorder-to-mp3';

/* ─── MUI icons ─────────────────────────────────────────────── */
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MicIcon from '@mui/icons-material/Mic';

/* ─── MUI components ────────────────────────────────────────── */
import { Menu, MenuItem, Button, CircularProgress } from '@mui/material';

/* ─── Styles & API ──────────────────────────────────────────── */
import '../styles/AudioRecorder.css';
import { uploadChunk, mergeChunks, deleteAudio } from '../api';

function AudioRecorder({
  sessionData,
  fetchSessionDetails,
  onStatusUpdate,
  onRecordingChange, // ← informs parent for “sticky” behaviour
}) {
  /* ------------------------------------------------------------ */
  /*  State & refs                                                */
  /* ------------------------------------------------------------ */
  const [status, setStatus] = useState('idle'); // idle | recording | paused | transcribing | done

  const recorderRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const waveformStreamRef = useRef(null);
  const animationFrameId = useRef(null);
  const canvasRef = useRef(null);

  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [accumulatedTime, setAccumulatedTime] = useState(0);
  const [timerDisplay, setTimerDisplay] = useState('00:00');

  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [micMenuAnchor, setMicMenuAnchor] = useState(null);

  /* ───────────────────────────────────────────────────────────── */
  /*  Notify parent when recording starts / stops                 */
  /* ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!onRecordingChange) return;
    const active = status === 'recording' || status === 'paused';
    onRecordingChange(active);
  }, [status, onRecordingChange]);

  /* ───────────────────────────────────────────────────────────── */
  /*  Enumerate input devices                                     */
  /* ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const inputs = devices.filter((d) => d.kind === 'audioinput');
        const defaultDev = inputs.find((d) => d.deviceId === 'default');

        /* de-duplicate by label, drop “default” clone */
        const filtered = [];
        const seen = new Set();
        inputs.forEach((d) => {
          if (d.deviceId === 'default') return;
          if (!seen.has(d.label)) {
            seen.add(d.label);
            filtered.push(d);
          }
        });

        /* choose initial mic */
        let chosen = '';
        if (defaultDev) {
          const base = defaultDev.label.replace(/^default\s*-\s*/i, '').trim();
          const match = filtered.find((d) => d.label.endsWith(base));
          if (match) chosen = match.deviceId;
        }
        if (!chosen && filtered.length) chosen = filtered[0].deviceId;

        setAudioDevices(filtered);
        setSelectedDeviceId(chosen);
      })
      .catch((err) => console.error('Enumerate devices error:', err));
  }, []);

  /* ───────────────────────────────────────────────────────────── */
  /*  Reset status on session change                              */
  /* ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (sessionData?.transcription_text) setStatus('done');
    else setStatus('idle');
    setAccumulatedTime(0);
    setTimerDisplay('00:00');
  }, [sessionData?.session_id, sessionData?.transcription_text]);

  /* ───────────────────────────────────────────────────────────── */
  /*  Delete audio after transcription                            */
  /* ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (
      status === 'done' &&
      sessionData?.transcription_text &&
      sessionData?.audio_file_path
    ) {
      deleteAudio(sessionData.session_id).catch((err) =>
        console.error('Error deleting audio:', err)
      );
    }
  }, [status, sessionData]);

  /* ───────────────────────────────────────────────────────────── */
  /*  Recording timer                                             */
  /* ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    let intervalId;
    if (status === 'recording') {
      const t0 = Date.now();
      setRecordingStartTime(t0);
      intervalId = setInterval(() => {
        const now = Date.now();
        updateTimerDisplay(accumulatedTime + (now - t0));
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, accumulatedTime]);

  const updateTimerDisplay = (msVal) => {
    const secs = Math.floor(msVal / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    setTimerDisplay(`${mm}:${ss}`);
  };

  /* ───────────────────────────────────────────────────────────── */
  /*  Recording controls                                          */
  /* ───────────────────────────────────────────────────────────── */
  const startRecording = async () => {
    try {
      setStatus('recording');
      onStatusUpdate?.('Recording…');

      /* waveform setup (once) */
      if (!waveformStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
        });
        waveformStreamRef.current = stream;

        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        ctx.createMediaStreamSource(stream).connect(analyser);

        drawWaveform();
      }

      /* mic-recorder */
      const rec = new MicRecorder({ bitRate: 64 });
      recorderRef.current = rec;
      await rec.start();
    } catch (err) {
      console.error('startRecording:', err);
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

      const [, blob] = await recorderRef.current.stop().getMp3();
      recorderRef.current = null;

      onStatusUpdate?.('Uploading partial…');
      await uploadChunk(sessionData.session_id, blob);

      setStatus('paused');
      onStatusUpdate?.('Paused.');
    } catch (err) {
      console.error('pauseRecording:', err);
    }
  };

  const resumeRecording = async () => {
    try {
      setStatus('recording');
      onStatusUpdate?.('Resumed…');
      setRecordingStartTime(Date.now());

      const rec = new MicRecorder({ bitRate: 64 });
      recorderRef.current = rec;
      await rec.start();
    } catch (err) {
      console.error('resumeRecording:', err);
    }
  };

  const stopRecording = async () => {
    try {
      setStatus('transcribing');
      onStatusUpdate?.('Finalizing…');

      if (recorderRef.current) {
        const now = Date.now();
        const totalMs = accumulatedTime + (now - recordingStartTime);
        setAccumulatedTime(totalMs);
        updateTimerDisplay(totalMs);

        const [, blob] = await recorderRef.current.stop().getMp3();
        recorderRef.current = null;
        await uploadChunk(sessionData.session_id, blob);
      }

      /* stop waveform */
      if (waveformStreamRef.current) {
        waveformStreamRef.current.getTracks().forEach((t) => t.stop());
        waveformStreamRef.current = null;
      }
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (audioCtxRef.current) audioCtxRef.current.close();

      onStatusUpdate?.('Merging chunks…');
      await mergeChunks(sessionData.session_id);

      await fetchSessionDetails?.(sessionData.session_id);
      setStatus('done');
      onStatusUpdate?.('Transcription complete');
    } catch (err) {
      console.error('stopRecording:', err);
      setStatus('idle');
      onStatusUpdate?.('Error during processing.');
    }
  };

  /* ───────────────────────────────────────────────────────────── */
  /*  Waveform renderer                                            */
  /* ───────────────────────────────────────────────────────────── */
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current)
      return;

    const ctx = canvasRef.current.getContext('2d');
    const analyser = analyserRef.current;
    const dataArr = dataArrayRef.current;
    const { width, height } = canvasRef.current;

    const BAR_COUNT = 28;
    const BAR_WIDTH = 1;
    const BAR_GAP = 3;
    const centerY = height / 2;
    const maxBarH = height / 2;
    const stepX = BAR_WIDTH + BAR_GAP;
    const leftPad =
      (width - BAR_COUNT * BAR_WIDTH - (BAR_COUNT - 1) * BAR_GAP) / 2;

    analyser.getByteFrequencyData(dataArr);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,1)';

    for (let i = 0; i < BAR_COUNT; i++) {
      const idx = Math.floor((i / BAR_COUNT) * dataArr.length);
      const amp = dataArr[idx] / 255;
      const barH = amp * maxBarH || 1;
      ctx.fillRect(
        leftPad + i * stepX,
        centerY - barH,
        BAR_WIDTH,
        barH * 2
      );
    }
    animationFrameId.current = requestAnimationFrame(drawWaveform);
  };

  /* ───────────────────────────────────────────────────────────── */
  /*  Main button factory                                         */
  /* ───────────────────────────────────────────────────────────── */
  const renderMainButton = () => {
    switch (status) {
      case 'idle':
        return (
          <Button
            onClick={startRecording}
            className="bubble-button start-button"
          >
            <FiberManualRecordIcon className="record-icon" />
            Start&nbsp;recording
          </Button>
        );
      case 'recording':
        return (
          <Button
            onClick={stopRecording}
            className="bubble-button stop-button"
          >
            <StopIcon className="stop-icon" />
            Stop recording
          </Button>
        );
      case 'paused':
        return (
          <Button
            onClick={stopRecording}
            className="bubble-button stopsave-button"
          >
            <StopIcon className="stop-icon" />
            Stop&nbsp;&&nbsp;save
          </Button>
        );
      case 'transcribing':
        return (
          <Button disabled className="bubble-button">
            <CircularProgress size={22} />
            Transcribing
          </Button>
        );
      default:
        return (
          <Button disabled className="bubble-button">
            <CheckCircleIcon className="done-icon" />
            Complete
          </Button>
        );
    }
  };

  /* ───────────────────────────────────────────────────────────── */
  /*  Render                                                      */
  /* ───────────────────────────────────────────────────────────── */
  const mainButtonSpansRows =
    status === 'idle' || status === 'transcribing';

  return (
    <div className="audio-recorder-card">
      {/* ROW 1: main button */}
      <div
        className="main-action"
        style={mainButtonSpansRows ? { gridRow: '1 / span 2' } : undefined}
      >
        {renderMainButton()}
      </div>

      {/* right-hand strip */}
      <div className="timer-waveform">
        {!sessionData?.transcription_text && (
          <span
            className={`timer-display ${
              status === 'paused' ? 'paused' : ''
            }`}
          >
            {timerDisplay}
          </span>
        )}

        {status !== 'done' && status !== 'transcribing' && (
          <canvas
            ref={canvasRef}
            className="waveform-canvas"
            width={80}
            height={30}
          />
        )}

        {/* mic selector */}
        <Button
          variant="text"
          className="mic-select-button"
          onClick={(e) => setMicMenuAnchor(e.currentTarget)}
          disabled={status !== 'idle'}
        >
          <MicIcon className="mic-icon" />
          <KeyboardArrowDownIcon className="mic-icon" />
        </Button>
      </div>

      {/* ROW 2 controls */}
      <div
        className="pause-cell"
        style={{
          display:
            status === 'recording' || status === 'paused' ? 'flex' : 'none',
        }}
      >
        {status === 'recording' && (
          <Button
            onClick={pauseRecording}
            className="secondary-btn pause-btn"
            startIcon={<PauseIcon />}
          >
            Pause
          </Button>
        )}

        {status === 'paused' && (
          <Button
            onClick={resumeRecording}
            className="secondary-btn resume-btn"
            startIcon={<PlayCircleIcon />}
          >
            Resume
          </Button>
        )}
      </div>

      <div
        className="cancel-cell"
        style={{
          display:
            status === 'recording' || status === 'paused' ? 'flex' : 'none',
        }}
      >
        {(status === 'recording' || status === 'paused') && (
          <Button onClick={stopRecording} className="secondary-btn">
            Cancel
          </Button>
        )}
      </div>

      {/* empty cell (grid alignment) */}
      <div className="mic-cell" />

      {/* mic-device dropdown */}
      <Menu
        anchorEl={micMenuAnchor}
        open={Boolean(micMenuAnchor)}
        onClose={() => setMicMenuAnchor(null)}
        PaperProps={{
          style: { maxHeight: 300, minWidth: 200, fontSize: '0.85rem' },
        }}
      >
        {audioDevices.map((d) => (
          <MenuItem
            key={d.deviceId}
            selected={d.deviceId === selectedDeviceId}
            onClick={() => {
              setSelectedDeviceId(d.deviceId);
              setMicMenuAnchor(null);
            }}
          >
            {d.label || `Mic (${d.deviceId.slice(0, 4)})`}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

export default AudioRecorder;
