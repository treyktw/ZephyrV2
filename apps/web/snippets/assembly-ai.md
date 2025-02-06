```
// npm install assemblyai

import { AssemblyAI } from 'assemblyai'

const client = new AssemblyAI({
  apiKey: ASSEMBLY_API_KEY
})

const audioUrl =
  'https://assembly.ai/sports_injuries.mp3'

const config = {
  audio_url: audioUrl
}

const run = async () => {
  const transcript = await client.transcripts.transcribe(config)
  console.log(transcript.text)
}

run()
```
