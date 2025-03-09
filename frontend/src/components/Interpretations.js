// src/components/Interpretations.js
import React, { useState } from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';
import ExpandInterpretationModal from './ExpandInterpretationModal';
import '../styles/SessionDetail.css';

function Interpretations({ interpretations, templates = [] }) {
  const [selectedInterp, setSelectedInterp] = useState(null);

  // Look up the template name by template ID
  const getTemplateName = (template_id) => {
    const found = templates.find(t => t.template_id === template_id);
    return found ? found.template_name : "Template Name";
  };

  const handleCardClick = (interp) => {
    setSelectedInterp(interp);
  };

  const handleCloseModal = () => {
    setSelectedInterp(null);
  };

  return (
    <div style={{ marginTop: '3rem' }}>
      <Grid container spacing={2} className="interpretations-grid">
        {interpretations.map((interp) => (
          <Grid item xs={12} sm={6} key={interp.interpretation_id}>
            <Card onClick={() => handleCardClick(interp)} className="interpret-card" style={{ cursor: 'pointer' }}>
              <CardContent>
                <Typography variant="caption" style={{
                  display: 'inline-block',
                  background: '#3F6FE4',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  marginBottom: '4px'
                }}>
                  {getTemplateName(interp.template_id)}
                </Typography>
                <Typography variant="body2" style={{ overflowY: 'auto', whiteSpace: 'pre-line' }}>
                  {interp.generated_text}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {selectedInterp && (
        <ExpandInterpretationModal
          open={Boolean(selectedInterp)}
          onClose={handleCloseModal}
          interpretation={selectedInterp}
          templateName={getTemplateName(selectedInterp.template_id)}
        />
      )}
    </div>
  );
}

export default Interpretations;
