import React, { ReactElement, useState } from 'react';
import { isApiError, makeApiPostRequest } from 'modules/api';

function Download(): ReactElement {
  const [uri, setUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDownload = async () => {
    try {
      setLoading(true);
      setError('');

      const result = await makeApiPostRequest('download', {
        uri,
      });

      if (isApiError(result)) {
        setError(result.message);
      } else {
        // Handle successful response
        console.log('Download initiated successfully');
      }
    } catch (err) {
      setError('Download failed');
      console.error('Download error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={uri}
        onChange={e => setUri(e.target.value)}
        placeholder="Enter URI"
        disabled={loading}
      />

      <button onClick={handleDownload} disabled={loading || !uri}>
        {loading ? 'Downloading...' : 'Download'}
      </button>

      {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
    </div>
  );
}

export default Download;
