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


// MUI components
import { Menu, MenuItem, Button, CircularProgress } from '@mui/material';

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
 /* ---------------------------------------------------------------
 *  Waveform renderer – thin, square-ended, evenly-spaced “LED” bars
 *  Tweak the four constants below to fine-tune the look.
 * ------------------------------------------------------------- */
const drawWaveform = () => {
  if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

  /* —--- Tweakables ---- */
  const BAR_COUNT  = 28;      // total bars on screen
  const BAR_WIDTH  = 1;       // each bar’s thickness  (px)
  const BAR_GAP    = 3;       // empty space between bars (px)
  const OPACITY    = 1;    // 0-1 – lower = more see-through
  /* ——————————————————— */

  const ctx       = canvasRef.current.getContext('2d');
  const analyser  = analyserRef.current;
  const dataArr   = dataArrayRef.current;
  const { width, height } = canvasRef.current;

  analyser.getByteFrequencyData(dataArr);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle   = `rgba(255,255,255,${OPACITY})`;  // white@90%
  ctx.lineCap     = 'butt';                          // square ends

  const centerY   = height / 2;
  const maxBarH   = height / 2;
  const stepX     = BAR_WIDTH + BAR_GAP;             // distance between bar *starts*
  const leftPad   = (width - (BAR_COUNT * BAR_WIDTH) - ((BAR_COUNT - 1) * BAR_GAP)) / 2;

  for (let i = 0; i < BAR_COUNT; i++) {
    // pick a sample from FFT buffer
    const idx     = Math.floor((i / BAR_COUNT) * dataArr.length);
    const amp     = dataArr[idx] / 255;              // 0-1
    const barH    = amp * maxBarH || 1;              // never 0
    const x       = leftPad + i * stepX;

    // draw a *filled rectangle* (square-ended) instead of a stroked line
    ctx.fillRect(
      x,
      centerY - barH,
      BAR_WIDTH,
      barH * 2
    );
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

 /* ────────────────── 8) Render the primary button ────────────────── */
const renderMainButton = () => {
  switch (status) {
    case 'idle':
      return (
        <Button onClick={startRecording} className="bubble-button start-button">
          <FiberManualRecordIcon className="record-icon" />
          Start&nbsp;recording
        </Button>
      );
    case 'recording':
      return (
        <Button onClick={stopRecording} className="bubble-button stop-button">
          <StopIcon className="stop-icon" />
          Stop recording
        </Button>
      );
    case 'paused':
      return (
        <Button onClick={stopRecording} className="bubble-button stopsave-button">
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
    default: /* done */
      return (
        <Button disabled className="bubble-button">
          <CheckCircleIcon className="done-icon" />
          Complete
        </Button>
      );
  }
};
  // ─────────────────────────────────────────────────────────────────────
  //  9) Conditional buttons for pause and mic select
  // ─────────────────────────────────────────────────────────────────────


 /* ───────────────────────── 10) Render ───────────────────────── */
  return (
    <div className="audio-recorder-card">

      {/* ROW-1  (two-column span + right strip) */}
      <div className="main-action">{renderMainButton()}</div>

      <div className="timer-waveform">
        {!sessionData?.transcription_text && (
          <span className={`timer-display ${status==='paused' ? 'paused':''}`}>
            {timerDisplay}
          </span>
        )}
        {(status!=='done' && status!=='transcribing') && (
          <canvas
            ref={canvasRef}
            className="waveform-canvas"
            width={80}
            height={30}
          />
        )}
        {/* mic selector always lives here */}
        <Button
          variant="text"
          className="mic-select-button"
          onClick={(e)=>setMicMenuAnchor(e.currentTarget)}
          disabled={status === 'transcribing'}
        >
          <MicIcon className='mic-icon'/><KeyboardArrowDownIcon className='mic-icon'/>
        </Button>
      </div>

      {/* ROW-2  (three cells) */}
      <div className="pause-cell">
        {status==='recording' && (
          <Button onClick={pauseRecording} className="secondary-btn pause-btn" startIcon={<PauseIcon/>}>
            Pause
          </Button>
        )}
        {status==='paused' && (
          <Button onClick={resumeRecording} className="secondary-btn resume-btn" startIcon={<PlayCircleIcon/>}>
            Resume
          </Button>
        )}
      </div>

      <div className="cancel-cell">
        {(status==='recording'||status==='paused') && (
          <Button onClick={stopRecording} className="secondary-btn">
            Cancel
          </Button>
        )}
      </div>

      <div className="mic-cell">{/* empty – occupied by selector above */}</div>

      {/* mic menu (unchanged) */}
      <Menu
        anchorEl={micMenuAnchor}
        open={Boolean(micMenuAnchor)}
        onClose={()=>setMicMenuAnchor(null)}
        PaperProps={{ style:{ maxHeight:300,minWidth:200,fontSize:'0.85rem'} }}
      >
        {audioDevices.map((d)=>(
          <MenuItem
            key={d.deviceId}
            selected={d.deviceId===selectedDeviceId}
            onClick={()=>{
              setSelectedDeviceId(d.deviceId);setMicMenuAnchor(null);}}
          >
            {d.label||`Mic (${d.deviceId.slice(0,4)})`}
          </MenuItem>
        ))}
      </Menu>
    </div>
  );
}

export default AudioRecorder;
