export const API_KEY = "71f993dfcb6e438f87b7fb03ab43badf";
const BASE_URL = "https://api.assemblyai.com/v2";

export const uploadAudio = async (file) => {
  const response = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: {
      "Authorization": API_KEY,
      "Content-Type": "application/octet-stream"
    },
    body: file
  });
  if (!response.ok) throw new Error("Upload failed");
  const data = await response.json();
  return data.upload_url;
};

export const requestTranscription = async (audioUrl) => {
  const response = await fetch(`${BASE_URL}/transcript`, {
    method: "POST",
    headers: {
      "Authorization": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ audio_url: audioUrl })
  });
  if (!response.ok) throw new Error("Transcription request failed");
  const data = await response.json();
  return data.id;
};

export const checkStatus = async (transcriptId) => {
  const response = await fetch(`${BASE_URL}/transcript/${transcriptId}`, {
    headers: { "Authorization": API_KEY }
  });
  if (!response.ok) throw new Error("Status check failed");
  return response.json();
};

export const transcribeFile = async (file, onProgress) => {
  onProgress("Uploading audio stream...");
  const uploadUrl = await uploadAudio(file);
  
  onProgress("Audio uploaded. Starting transcription...");
  const transcriptId = await requestTranscription(uploadUrl);
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await checkStatus(transcriptId);
        if (status.status === "completed") {
          resolve(status);
        } else if (status.status === "error") {
          reject(new Error(status.error));
        } else {
           onProgress(`Processing transcription... (${status.status})`);
           setTimeout(poll, 3000);
        }
      } catch (err) {
        reject(err);
      }
    };
    setTimeout(poll, 3000); // Poll every 3 seconds
  });
};

export const REALTIME_URL = "wss://api.assemblyai.com/v2/realtime/websocket";
// Archived: Realtime token functions removed to restore stable polling flow.
