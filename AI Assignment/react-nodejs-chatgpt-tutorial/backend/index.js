import { Configuration, OpenAIApi } from "openai";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import multer from 'multer';
import {PdfReader} from 'pdfreader';
import fsAsync from 'fs/promises';
import fs from 'fs';
import csv from 'csv-parser';


//Change the path based on the OS
const PATH_TO_STORE_EMBEDDED_DATA = './resources/EmbeddingFileStore.csv';
const TEXT_MODEL_TO_USE = "text-davinci-003";
const app = express();
const port = 8080;

app.use(bodyParser.json());
app.use(cors());

// Set up multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const configuration = new Configuration({
  organization: "",
  apiKey: "",
});

const openai = new OpenAIApi(configuration);

app.get("/", async (request, response) => {  

  response.send('Welcome to AI Assignment Bot running on port 8080');
});

app.post("/", async (request, response) => {
  const { chats } = request.body;
  const prompt = chats.content;

  const embeddingData = await getEmbeddedCSVFile();

  let  completion = 'Hi, Welcome to AI Assignment Bot. Please provide the query to assist you';

  if (Object.keys(embeddingData).length > 0) {

    const finalPrompt = await createEmbeddingForInput(prompt,embeddingData);    
    
    const api_response = await openai.createCompletion({
      model: TEXT_MODEL_TO_USE,
      prompt: finalPrompt,
      max_tokens: 64,

    });

    completion = api_response.data.choices[0].text;
  }

  response.json({
    output: { role: "AI_Assignment_Bot", content: completion },
  });
  
});

app.post('/api/upload-pdf', upload.array('files',100), async (req, res) => {
  try {
    const files = req.files;
    const fileResponses = await Promise.all(files.map(async (file, index) => {
      // Extract text from the uploaded PDF
      const pdfText = await extractTextFromPDF(file.buffer);   
      // Use OpenAI to generate embedding from the PDF text
      const pdfEmbedding = await embeddedInputValue(pdfText, 'text-embedding-ada-002');
      console.log(pdfEmbedding);
      await storeEmbeddedDataToCSV(pdfText,JSON.stringify(pdfEmbedding));   
      return `File ${file.originalname} uploaded successfully`;
    }));
    console.log(fileResponses);     
    res.json({ fileResponses });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function createEmbeddingForInput(prompt,embeddingData) {

  // get embeddings value for prompt question
  const embeddedInputQuery = await embeddedInputValue(prompt, 'text-embedding-ada-002');

  // create map of text against similarity score
  const hashedSimilarityScore = getSimilarityScore(embeddingData,embeddedInputQuery);

  // get text (i.e. key) from score map that has highest similarity score
  const generatedScoreForText = Object.keys(hashedSimilarityScore).reduce(
    (a, b) => (hashedSimilarityScore[a] > hashedSimilarityScore[b] ? a : b)
  );

  // build the response that needs to be displayed to the user
  const messageToSend = `
    Info: ${generatedScoreForText}
    Question: ${prompt}
    Answer:
    `;
  return messageToSend;
}

// Function to read data from a CSV file
function readEmbeddedCSVFile(csvFilePath) {
  const data = {};
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        data[row["Text"]] = row["EmbeddedValue"];        
      })
      .on('end', () => {
        resolve(data);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

function cosineSimilarity(A, B) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  return dotProduct / (normA * normB);
}

function getSimilarityScore(embeddingsHash, embeddedInputQuery) {
  const hashedSimilarityScore = {};
  Object.keys(embeddingsHash).forEach((text) => {
    hashedSimilarityScore[text] = cosineSimilarity(
      embeddedInputQuery,
      JSON.parse(embeddingsHash[text])
    );
  });
  return hashedSimilarityScore;
}


const getEmbeddedCSVFile = async ()=>{ 
  const fileData = await readEmbeddedCSVFile(PATH_TO_STORE_EMBEDDED_DATA);
  console.log(fileData);
  return fileData;
}

const storeEmbeddedDataToCSV =  async (fileText,fileEmbedding)=>{

   const data = [fileText, fileEmbedding]
   const formattedData = data.map(row => `"${row}"`).join(',');

  await fsAsync.appendFile(PATH_TO_STORE_EMBEDDED_DATA,formattedData +'\n');
}

// Extract text from PDF using pdf-parse
const extractTextFromPDF = (pdfBuffer) => {

  return new Promise((resolve, reject) => {

    const textLines = [];

    new PdfReader().parseBuffer(pdfBuffer, (err, item) => {
      if (err) {
        console.error("error:", err);
        reject(err);
      }
      else if (!item) {
        console.warn("end of buffer");
        const pageText = textLines.join('');//'\n'
        resolve(pageText);

      }
      else if (item.text) {
        textLines.push(item.text);
        console.log(item.text);
      }
    });
  });

};

// Generate embedding using OpenAI API
const embeddedInputValue = async (text, model) => {
  const response = await openai.createEmbedding({
    model: model,
    input: text,
  });

  return response.data.data[0].embedding;
};

// Generate chat response using OpenAI API
const generateChatResponse = async (query, context, model) => {
  const response = await openai.createCompletion({
    model: model,
    prompt: query,
    max_tokens: 150,
    context: context,
  });

  return response.data.choices[0].text.trim();
};
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

