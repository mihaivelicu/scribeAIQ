// src/components/AudioRecorder.js
import React, { useState, useEffect, useRef } from 'react';
import { Typography } from '@mui/material';
import MicRecorder from 'mic-recorder-to-mp3';
import { uploadAudio } from '../api';
import '../styles/AudioRecorder.css';

import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import StopIcon from '@mui/icons-material/Stop';

function AudioRecorder({
  sessionData,            // { session_id, transcription_text, audio_file_path, etc. }
  fetchSessionDetails,    // function to re-fetch session details from the parent
  onStatusUpdate          // optional callback for status messages
}) {
  const [status, setStatus] = useState('idle');
  const [isRecording, setIsRecording] = useState(false);

  // Reset state when a new session is loaded
  useEffect(() => {
    setStatus('idle');
    setIsRecording(false);
  }, [sessionData?.session_id]);

  // References for recorder and waveform drawing
  const recorderRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const waveformStreamRef = useRef(null);

  // Initialize the mic recorder once on mount
  useEffect(() => {
    recorderRef.current = new MicRecorder({ bitRate: 64 });
  }, []);

  // Update status based on sessionData changes
  useEffect(() => {
    if (sessionData?.transcription_text) {
      setStatus('done');
    } else if (status !== 'recording' && status !== 'transcribing') {
      setStatus('idle');
    }
  }, [sessionData]);

  // Return a label corresponding to the current status
  const getStatusLabel = () => {
    switch (status) {
      case 'idle': return 'Start recording a session';
      case 'recording': return 'Recording in progress ...';
      case 'transcribing': return 'Transcribing in progress ...';
      case 'done': return 'Transcription complete';
      default: return '';
    }
  };

  // Draw the audio waveform
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    const bufferLength = analyser.frequencyBinCount;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    analyser.getByteFrequencyData(dataArray);
    const barWidth = canvas.width / bufferLength;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = '#FF6AA8';
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    }
    animationFrameId.current = requestAnimationFrame(drawWaveform);
  };

  // Start recording audio
  const startRecording = async () => {
    try {
      setStatus('recording');
      onStatusUpdate?.('Recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      waveformStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      drawWaveform();
      await recorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      onStatusUpdate?.('Error accessing microphone.');
      setStatus('idle');
    }
  };

  // Stop recording and upload the audio
  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setStatus('transcribing');
      onStatusUpdate?.('Uploading MP3...');
      const [, blob] = await recorderRef.current.stop().getMp3();
      if (waveformStreamRef.current) {
        waveformStreamRef.current.getTracks().forEach(track => track.stop());
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
      const mp3File = new File([blob], `session_${sessionData.session_id}.mp3`, {
        type: 'audio/mp3',
      });
      await uploadAudio(sessionData.session_id, mp3File);
      if (fetchSessionDetails) {
        await fetchSessionDetails(sessionData.session_id);
      }
      onStatusUpdate?.('Transcription complete');
    } catch (err) {
      console.error('Error stopping recording:', err);
      setStatus('idle');
      onStatusUpdate?.('Error during processing.');
    }
  };

  // Determine if server audio exists
  const hasServerAudio = !!sessionData?.audio_file_path;
  // Show record controls only if there's no audio file available from the server
  const showRecordingControls = !hasServerAudio;

  return (
    <div className="audio-recorder-wrapper">
      <div className="status-monitor">
        <Typography variant="caption" style={{
          display: 'inline-block',
          background: '#3F6FE4',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '4px',
          marginBottom: '4px'
        }}>
          <span className="status-tag">{getStatusLabel()}</span>
        </Typography>
      </div>

      <div className="audio-recorder-controls">
        {showRecordingControls && (
          <div className="controls-container">
            <div className="rec-part">
            <button
              onClick={startRecording}
              disabled={isRecording}
              className={isRecording ? 'record-button blipping' : 'record-button'}
              style={{ display: 'flex', alignItems: 'center', padding: '10px', border: 'none', background: 'none' }}
            >
              <GraphicEqIcon style={{ fontSize: '35px' }} color="seconred" />
              {isRecording ? (
                <span className="record-label blipping" style={{ marginLeft: '10px' }}>RECORDING</span>
              ) : (
                <span className="record-label" style={{ marginLeft: '10px' }}>RECORD</span>
              )}
            </button>
          </div>

            <div className="waveform-container">
              <canvas
                ref={canvasRef}
                className="waveform-canvas"
                width={200}
                height={50}
                style={{ width: isRecording ? '200px' : '0px', height: '50px' }}
              />
            </div>

            {isRecording && (
              <div className="stop-part">
              <button 
                onClick={stopRecording} 
                className="stop-button" 
                style={{ display: 'flex', alignItems: 'center', padding: '10px', border: 'none', background: 'none' }}
              >
                <StopIcon style={{ fontSize: '35px' }} color="seconred" />
                <span className="stop-label" style={{ marginLeft: '10px' }}>STOP</span>
              </button>
            </div>
            )}
          </div>
        )}
      </div>

      {hasServerAudio && (
        <div className="playback-container">
          <audio className="player" controls src={sessionData.audio_file_path} />
        </div>
      )}
    </div>
  );
}

export default AudioRecorder;
