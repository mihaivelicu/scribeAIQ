// src/components/SessionDetail.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SessionTitle from './SessionTitle';
import AudioRecorder from './AudioRecorder';
import TemplateBar from './TemplateBar';
import Interpretations from './Interpretations';
import TemplateModal from './TemplateModal';
import '../styles/SessionDetail.css';

function SessionDetail({ sessionData, onSessionUpdate, fetchSessionDetails }) {
  const [interpretations, setInterpretations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Load interpretations whenever the session ID changes.
  useEffect(() => {
    if (sessionData?.session_id) {
      const loadInterpretations = async () => {
        try {
          const res = await axios.get(`/api/interpretations?session_id=${sessionData.session_id}`);
          setInterpretations(res.data);
        } catch (err) {
          console.error("Error loading interpretations:", err);
          setInterpretations([]);
        }
      };
      loadInterpretations();
    } else {
      setInterpretations([]);
    }
  }, [sessionData?.session_id]);

  // Load templates on mount.
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await axios.get('/api/templates');
        setTemplates(res.data);
      } catch (err) {
        console.error("Error loading templates:", err);
        setTemplates([]);
      }
    };
    fetchTemplates();
  }, []);

  // Handle generating a new interpretation.
  const handleGenerateInterpretation = async (templateId) => {
    if (!sessionData.transcription_text) {
      alert("No transcription available yet.");
      return;
    }
    try {
      const res = await axios.post('/api/interpretations', {
        session_id: sessionData.session_id,
        template_id: templateId,
      });
      // Prepend the new interpretation to the list.
      setInterpretations((prev) => [res.data, ...prev]);
    } catch (err) {
      console.error("Error generating interpretation:", err);
    }
  };

  if (!sessionData?.session_id) {
    return <p>No session selected.</p>;
  }

  return (
    <div className="session-detail">
      <div className="session-row row-title">
        <SessionTitle
          sessionData={sessionData}
          onSessionUpdate={onSessionUpdate}
          fetchSessionDetails={fetchSessionDetails}
        />
      </div>

      <div className="recdiv">
        <AudioRecorder
          sessionData={sessionData}
          fetchSessionDetails={fetchSessionDetails}
        />
      </div>

      <div className="templatediv">
        <TemplateBar
          sessionData={sessionData}
          onGenerateInterpretation={handleGenerateInterpretation}
          onOpenTemplateModal={() => setShowTemplateModal(true)}
        />
      </div>

      <div className="session-row row-interp">
        <Interpretations interpretations={interpretations} templates={templates} />
      </div>

      {showTemplateModal && (
        <TemplateModal
          onClose={() => setShowTemplateModal(false)}
          onTemplateCreated={() => {
            // Optionally, refresh your templates or notify TemplateBar if needed.
            setShowTemplateModal(false);
          }}
        />
      )}
    </div>
  );
}

export default SessionDetail;
