export default async function handler(req, res) {
  // 1. CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://tubescript-ten.vercel.app/'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  // --- DEBUGGING CHECK ---
  if (!process.env.RAPIDAPI_KEY) {
    console.error("ERROR: RAPIDAPI_KEY environment variable is missing in Vercel.");
    return res.status(500).json({ error: 'Server Configuration Error: API Key missing.' });
  }

  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const rapidApiKey = process.env.RAPIDAPI_KEY; 
    const rapidApiHost = 'youtube-transcripts.p.rapidapi.com'; 

    const apiUrl = `https://${rapidApiHost}/transcript?videoId=${videoId}`;
    
    console.log(`Fetching transcript for video: ${videoId}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': rapidApiHost
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RapidAPI External Error:", errorText);
      // Pass the actual upstream error message to the frontend for better debugging
      throw new Error(`RapidAPI Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    let formattedTranscript = [];
    const rawTranscript = data.body || data.content || data;

    if (Array.isArray(rawTranscript)) {
      formattedTranscript = rawTranscript.map(item => ({
        text: item.text || item.snippet,
        start: parseFloat(item.start || item.startTime),
        duration: parseFloat(item.dur || item.duration)
      }));
    } else {
        console.error("Unexpected Data Structure:", JSON.stringify(data));
        throw new Error("API returned unexpected data format. Check Function Logs.");
    }

    return res.status(200).json({ transcript: formattedTranscript });

  } catch (error) {
    console.error('Handler Critical Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

function extractVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}