// src/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '', // Use relative URLs so that Nginx proxies correctly.
  headers: {
    'Content-Type': 'application/json'
  }
});

export function getSessions() {
  return apiClient.get('/api/sessions');
}

export function createSession(sessionTitle) {
  return apiClient.post('/api/sessions', { session_title: sessionTitle });
}

export function uploadAudio(sessionId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return axios.post(`/api/sessions/${sessionId}/audio`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
}

export function getTemplates() {
  return apiClient.get('/api/templates');
}

export function createTemplate(templateName, templateText) {
  return apiClient.post('/api/templates', {
    template_name: templateName,
    template_text: templateText,
  });
}

export function generateInterpretation(sessionId, templateId) {
  return apiClient.post('/api/interpretations', { session_id: sessionId, template_id: templateId });
}

// New function to delete a session
export function deleteSession(sessionId) {
  return apiClient.delete(`/api/sessions/${sessionId}`);
}

