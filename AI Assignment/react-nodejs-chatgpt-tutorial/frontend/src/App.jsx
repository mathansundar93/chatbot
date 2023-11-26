import { useState } from "react";
import axios from 'axios';
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [chats, setChats] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pdfFiles, setPdfFiles] = useState(null);
  const [uploadResponse, setUploadResponse] = useState(null);
  const closeBanner = () => {
    setIsVisible(false);
  };
  
  const chat = async (e, message) => {
    e.preventDefault();

    if (!message) return;
    setIsTyping(true);
    scrollTo(0, 1e10);

    let msgs = chats;
    let latestUserPrompt = { role: "user", content: message };
    msgs.push(latestUserPrompt);
    setChats(msgs);

    setMessage("");

    fetch("http://localhost:8080/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chats : latestUserPrompt,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        msgs.push(data.output);
        setChats(msgs);
        setIsTyping(false);
        scrollTo(0, 1e10);
      })
      .catch((error) => {
        console.log(error);
      });
  };
  const handleFileChange = (e) => {
    setPdfFiles(e.target.files);
  };

  const handleSendMessage = async () => {
    

    // Send the PDF file to the server
    try {
      const formData = new FormData();      
      //TODO:
      //formData.append('pdf', pdfFile);
      Array.from(pdfFiles).forEach((file, index) => {
        formData.append(`files`, file);
      });
      axios.defaults.baseURL = 'http://localhost:8080';
      const response = await axios.post('/api/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });      
      setUploadResponse(response.data.fileResponses);
    } catch (error) {
      console.error('Error fetching response from server:', error);
    }

    // Clear the  PDF file    
    setPdfFiles(null);
  };
  return (
    <main>
      <h1>AI Assignment Bot</h1>
      <div class="container">  
      <input multiple id="file-upload" type="file" accept=".pdf" onChange={handleFileChange} />
      <button class = "uploadBtn" onClick={handleSendMessage} disabled={!pdfFiles}>
        Upload pdf file
      </button>  </div>
      {uploadResponse && (
        <div>
          <h2>Upload Response:</h2>
          <ul>
            {uploadResponse.map((response, index) => (
              <li key={index}>{response}</li>
            ))}
          </ul>
        </div>
        // <div class="success-banner">
        //   <p class="message">{fileResponses}</p>
        // </div>
      )}
      <section>
        {chats && chats.length
          ? chats.map((chat, index) => (
              <p key={index} className={chat.role === "user" ? "user_msg" : ""}>
                <span>
                  <b>{chat.role.toUpperCase()}</b>
                </span>
                <span>:</span>
                <span>{chat.content}</span>
              </p>
            ))
          : ""}
      </section>

      <div className={isTyping ? "" : "hide"}>
        <p>
          <i>{isTyping ? "Typing" : ""}</i>
        </p>
      </div>
      <br></br> <br></br> <br></br>
      <form action="" onSubmit={(e) => chat(e, message)}>
        <input
          type="text"
          name="message"
          value={message}
          placeholder="Type a message here and hit Enter..."
          onChange={(e) => setMessage(e.target.value)}
        />
        <br></br>
        <button onClick={(e) => chat(e, message)} style={{marginTop: '30px', marginLeft: '10px', padding: '15px' }}>
          Send
        </button>
      </form>
    </main>
  );
}

export default App;
