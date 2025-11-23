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

  // Debugging: Check if key exists
  if (!process.env.RAPIDAPI_KEY) {
    console.error("ERROR: RAPIDAPI_KEY environment variable is missing in Vercel.");
    return res.status(500).json({ error: 'Server Configuration Error: API Key missing.' });
  }

  try {
    // --- CONFIGURATION UPDATED FOR YOUR SPECIFIC API ---
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const rapidApiHost = 'youtube-transcripts.p.rapidapi.com'; // Matches your screenshot
    
    // This specific API expects the full URL as a query parameter
    const apiUrl = `https://${rapidApiHost}/youtube/transcript?url=${encodeURIComponent(url)}`;

    console.log(`Fetching transcript from: ${rapidApiHost}`);

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
      throw new Error(`RapidAPI Failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // --- DATA NORMALIZATION ---
    // This API usually returns data in a "content" array.
    // It often uses 'offset' (milliseconds) instead of 'start' (seconds).
    
    let formattedTranscript = [];
    // Check for 'content', 'transcript', or just the data object itself
    const rawTranscript = data.content || data.transcript || data;

    if (Array.isArray(rawTranscript)) {
      formattedTranscript = rawTranscript.map(item => {
        // Handle time format differences
        // If 'offset' exists, it's usually in ms. If 'start' exists, it could be s or ms.
        let startTime = parseFloat(item.offset || item.start || 0);
        let duration = parseFloat(item.duration || item.dur || 0);

        // Heuristic: If time is in milliseconds (API dependent), convert to seconds
        // 'youtube-transcripts' often uses ms for offset.
        if (item.offset !== undefined) {
            startTime = startTime / 1000;
            duration = duration / 1000;
        }

        return {
          text: item.text || item.snippet || "",
          start: startTime,
          duration: duration
        };
      });
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