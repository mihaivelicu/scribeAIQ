// src/components/SessionDetail.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import NotesOutlinedIcon           from '@mui/icons-material/NotesOutlined';
import GraphicEqIcon               from '@mui/icons-material/GraphicEq';

import TemplateBar    from './TemplateBar';
import Interpretations from './Interpretations';

import '../styles/SessionDetail.css';


function SessionDetail({ sessionData, fetchSessionDetails, onCreateSession }) {
  /* ------------------------------------------------------------ */
  /*  Local state                                                 */
  /* ------------------------------------------------------------ */
  const [interpretations, setInterpretations] = useState([]);
  const [templates,       setTemplates]       = useState([]);
  const [activeTab,       setActiveTab]       = useState('summary');
  const [isWriting, setIsWriting] = useState(false);

  /* ------------------------------------------------------------ */
  /*  Helpers                                                     */
  /* ------------------------------------------------------------ */
  const refreshInterpretations = async (sid) => {
    if (!sid) { setInterpretations([]); return; }
    try {
      const res = await axios.get(`/api/interpretations?session_id=${sid}`);
      setInterpretations(res.data);
    } catch (err) { console.error(err); setInterpretations([]); }
  };

  const refreshTemplates = async () => {
    try {
      const res = await axios.get('/api/templates');
      setTemplates(res.data);
    } catch (err) { console.error('Error fetching templates:', err); }
  };

  /* ------------------------------------------------------------ */
  /*  Effects                                                     */
  /* ------------------------------------------------------------ */
  /* reset tab & reload notes whenever session changes */
  useEffect(() => {
    setActiveTab('summary');
    refreshInterpretations(sessionData?.session_id);
  }, [sessionData?.session_id]);

  /* get template list once on mount                               */
  useEffect(() => { refreshTemplates(); }, []);

  /* ------------------------------------------------------------ */
  /*  After WRITE-NOTE callback                                   */
  /* ------------------------------------------------------------ */
  const handleGenerateInterpretation = async (templateId) => {
    if (!sessionData?.session_id) return;
    setIsWriting(true);                                 // NEW
    try {
      await axios.post('/api/interpretations', {
        session_id: sessionData.session_id,
        template_id: templateId,
      });
      await refreshInterpretations(sessionData.session_id);
      await refreshTemplates();
      fetchSessionDetails?.(sessionData.session_id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsWriting(false);                              // NEW
    }
  };

  /* ------------------------------------------------------------ */
  /*  Flags                                                       */
  /* ------------------------------------------------------------ */
  const noSession    = !sessionData;
  const hasTranscript = Boolean(sessionData?.transcription_text);
  const hasNotes      = interpretations.length > 0;

  /* ------------------------------------------------------------ */
  /*  Tab-button component                                        */
  /* ------------------------------------------------------------ */
  const TabButton = ({ id, icon: Icon, label }) => {
    const disabled = !hasTranscript;          // disable until transcript exists
    return (
      <button
        className={`tab-button ${activeTab === id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setActiveTab(id)}
        disabled={disabled}
      >
        <span className="tab-button-wrapper">
          <Icon fontSize="small" />
          <span className="tab-label">{label}</span>
        </span>
      </button>
    );
  };

  /* ------------------------------------------------------------ */
  /*  Main render                                                 */
  /* ------------------------------------------------------------ */
  return (
    <div className="sd-container">

      {/* ─── TOP BAR (always visible) ─── */}
      <div className="above-bar">
        <div className="tab-btns">
          <TabButton id="summary"    icon={InsertDriveFileOutlinedIcon} label="Summary"    />
          <TabButton id="letter"     icon={NotesOutlinedIcon}           label="Letter"     />
          <TabButton id="transcript" icon={GraphicEqIcon}              label="Transcript" />
        </div>

        <div className="tpl-cont">
          <TemplateBar
            sessionData={sessionData}
            transcriptReady={Boolean(sessionData?.transcription_text)}
            interpretationsCount={interpretations.length}
            writing={isWriting} 
            onGenerateInterpretation={handleGenerateInterpretation}
          />
        </div>
      </div>

      {/* ─── MAIN BOX ─── */}
      <div className="session-detail">

        {/* ───────── SUMMARY TAB ───────── */}
        {activeTab === 'summary' && (
          noSession ? (
            <div className="card_container">
              <div className="placeholder-card">
                <p className="card-title">Start a new session</p>
                <p className="card-description">
                  You don’t have any session open yet.
                </p>
                <button className="primary-btn" onClick={onCreateSession}>
                  Create a new session
                </button>
              </div>
            </div>
          ) : !hasTranscript ? (
            <div className="card_container">
              <div className="placeholder-card">
                <p className="card-title">No recording yet</p>
                <p className="card-description">
                  This session has no audio.<br/>
                  Use the recorder in the sidebar first.
                </p>
              </div>
            </div>
          ) : hasNotes ? (
            <div className="interp_container">
              <Interpretations
                interpretations={interpretations}
                templates={templates}
                isWriting={isWriting}
              />
            </div>
          ) : (
            <div className="card_container">
              <div className="placeholder-card">
                <p className="card-title">Now generate a note</p>
                <p className="card-description">
                  Select a template from the dropdown above<br/>
                  and write this session&#39;s first note.
                </p>
              </div>
            </div>
          )
        )}

        {/* ───────── TRANSCRIPT TAB ───────── */}
        {activeTab === 'transcript' && (
          hasTranscript ? (
            <pre style={{
              padding:'2rem',
              width:'100%', height:'100%',
              overflowY:'auto',
              fontFamily:'inherit', fontSize:'14px', lineHeight:'22px',
              whiteSpace:'pre-wrap', textAlign:'left'
            }}>
              {sessionData.transcription_text}
            </pre>
          ) : (
            <div className="card_container">
              <div className="placeholder-card">
                <p className="card-title">Transcript view</p>
                <p className="card-description">
                  You’ll see the transcript here once a recording is finished.
                </p>
              </div>
            </div>
          )
        )}

        {/* ───────── LETTER TAB ───────── */}
        {activeTab === 'letter' && (
          <div className="card_container">
            <div className="placeholder-card">
              <p className="card-title">Letter view</p>
              <p className="card-description">Coming soon…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SessionDetail;
