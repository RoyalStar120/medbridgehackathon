import https from 'https';

const API_KEY = 'AIzaSyDZZVpf0kh6E-3VrcCJPGWizzYMrwZQ4d0';
const MODEL = 'veo-3.1-generate-preview';
const PROJECT_ID = ''; // The API key is usually tied to a project implicitly for Gemini, let's test if Vertex AI requires a different endpoint.

async function generateVideo() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predictLongRunning?key=${API_KEY}`;
  
  const payload = JSON.stringify({
    instances: [
      { prompt: "A hyper-realistic 3D medical animation of a beating human heart, cinematic lighting." }
    ],
    parameters: {
      sampleCount: 1
    }
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

generateVideo().then(console.log).catch(console.error);
