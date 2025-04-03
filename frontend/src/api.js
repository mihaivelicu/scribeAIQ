// src/api.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '', // Use relative URLs so that Nginx (or another proxy) can route correctly.
  headers: {
    'Content-Type': 'application/json',
  },
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
    headers: { 'Content-Type': 'multipart/form-data' },
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
  return apiClient.post('/api/interpretations', {
    session_id: sessionId,
    template_id: templateId,
  });
}

// Delete an entire session
export function deleteSession(sessionId) {
  return apiClient.delete(`/api/sessions/${sessionId}`);
}

// Delete ONLY the audio file for a session
export function deleteAudio(sessionId) {
  return apiClient.delete(`/api/sessions/${sessionId}/audio`);
}

export async function uploadChunk(sessionId, fileBlob) {
  // Accepts a Blob or File for a partial MP3
  const formData = new FormData();
  // We'll name it "chunk.mp3" or any unique name
  formData.append('file', new File([fileBlob], 'chunk.mp3', { type: 'audio/mp3' }));
  
  const res = await axios.post(`/api/sessions/${sessionId}/chunks`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function mergeChunks(sessionId) {
  const res = await axios.post(`/api/sessions/${sessionId}/merge-chunks`);
  return res.data;
}

export function updateTemplate(templateId, templateName, templateText) {
  return apiClient.put(`/api/templates/${templateId}`, {
    template_name: templateName,
    template_text: templateText,
  });
}

export function deleteTemplate(templateId) {
  return apiClient.delete(`/api/templates/${templateId}`);
}

export function toggleFavorite(templateId, isFavorite) {
  return apiClient.put(`/api/templates/${templateId}/favorite`, {
    favorite: isFavorite,
  });
}

