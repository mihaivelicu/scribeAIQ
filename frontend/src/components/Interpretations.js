import React, { useState } from 'react';
import { Tabs, Tab, Box, Card, CardContent, Typography, Button } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandInterpretationModal from './ExpandInterpretationModal';
import '../styles/Interpretations.css';

function Interpretations({ interpretations, templates = [] }) {
  // Local state: selected tab index for which note to display,
  // and (if needed) a separate state for triggering the expand modal.
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedInterp, setSelectedInterp] = useState(null);

  // Ensure interpretations are sorted most-recent to oldest.
  const sortedInterps = interpretations.slice().sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Lookup a template name by its ID.
  const getTemplateName = (template_id) => {
    const found = templates.find(t => t.template_id === template_id);
    return found ? found.template_name : "Template Name";
  };

  // Handle tab change.
  const handleTabChange = (event, newValue) => {
    setSelectedTab(newValue);
  };

  // Copy-to-clipboard functionality.
  const handleCopy = () => {
    const text = sortedInterps[selectedTab]?.generated_text || "";
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  return (
    <Box sx={{ width: '30rem', marginTop: '1rem' }}>
      {/* Tabs for interpretations */}
      <Tabs
        value={selectedTab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Interpretation tabs"
      >
        {sortedInterps.map((interp, index) => (
          <Tab
            key={interp.interpretation_id}
            label={getTemplateName(interp.template_id)}
            sx={{
              textTransform: 'none',
              fontSize: '0.8rem',
              color: 'gray'
            }}
          />
        ))}
      </Tabs>

      {/* Display the selected interpretation in a card */}
      {sortedInterps.length > 0 && (
        <Card sx={{ marginTop: 2 }}>
          <CardContent>
            {/* Top row: template name (in gray) on the left, and Copy button on the right */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'gray',
                  backgroundColor: '#f0f0f0',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                {getTemplateName(sortedInterps[selectedTab].template_id)}
              </Typography>
              <Button
                onClick={handleCopy}
                startIcon={<ContentCopyIcon sx={{ fontSize: '1rem' }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.8rem'
                }}
              >
                Copy
              </Button>
            </Box>
            {/* Interpretation generated text */}
            <Typography variant="body2" sx={{ marginTop: 1, whiteSpace: 'pre-line' }}>
              {sortedInterps[selectedTab].generated_text}
            </Typography>
          </CardContent>
        </Card>
      )}

      {selectedInterp && (
        <ExpandInterpretationModal
          open={Boolean(selectedInterp)}
          onClose={() => setSelectedInterp(null)}
          interpretation={selectedInterp}
          templateName={getTemplateName(selectedInterp.template_id)}
        />
      )}
    </Box>
  );
}

export default Interpretations;
