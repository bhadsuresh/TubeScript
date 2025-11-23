export default async function handler(req, res) {
  // 1. CORS Configuration (Allow requests from your frontend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Replace '*' with your actual domain in production
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle Preflight Options
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  try {
    // 2. Extract Video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // 3. RapidAPI Configuration
    // IMPORTANT: Move these to Environment Variables in Vercel dashboard for security
    const rapidApiKey = process.env.RAPIDAPI_KEY; 
    const rapidApiHost = 'youtube-transcripts.p.rapidapi.com'; // This depends on exactly which API you subscribed to

    // 4. Call RapidAPI
    // Note: We use the native fetch API (Node 18+)
    const apiUrl = `https://${rapidApiHost}/transcript?videoId=${videoId}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': rapidApiHost
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RapidAPI Error:", errorText);
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    // 5. Normalize Data for Frontend
    // Different APIs return different structures. 
    // The frontend expects: [{ text: string, start: number, duration: number }]
    // This block ensures the data matches that format.
    
    let formattedTranscript = [];

    // Check if the API returned 'body', 'content', or just an array
    const rawTranscript = data.body || data.content || data;

    if (Array.isArray(rawTranscript)) {
      formattedTranscript = rawTranscript.map(item => ({
        text: item.text || item.snippet, // Some APIs use 'snippet' instead of 'text'
        start: parseFloat(item.start || item.startTime),
        duration: parseFloat(item.dur || item.duration)
      }));
    } else {
        throw new Error("Unexpected API response format");
    }

    // 6. Return Data
    return res.status(200).json({ transcript: formattedTranscript });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ error: 'Failed to fetch transcript. The video might not have captions.' });
  }
}

// --- Helper Function ---
function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}