# Backend (FastAPI + LangChain + Ollama)

This backend provides a local chat API using **Ollama** for LLM inference, **LangChain** for conversational memory, and **FastAPI** as the web server. It includes streaming token responses and persistent history per model.

Main file: `main.py`  
Requirements: see `requirements.txt`

---

## Dependencies

- **fastapi**, **uvicorn** – Web server and ASGI.
- **langchain-ollama** – LangChain wrapper for Ollama.
- **langchain-community** – Chat history and utilities.
- **(optional) chromadb**, **sentence-transformers** – If vector memory is enabled.

Installation:
```bash
python -m venv venv
source venv/bin/activate             # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## Structure of `main.py`

```
main.py
├─ Global configuration
│  ├─ OLLAMA_MODELS (cache of ChatOllama instances)
│  └─ PROMPTS_CACHE (cache of prompts per model)
│
├─ FastAPI app creation + CORS
│
├─ Pydantic models
│  └─ ChatRequest  ← payload of /chat and /chat/stream
│
├─ Utility functions
│  ├─ get_history_for_model(model_name)     ← JSON history per model
│  ├─ get_prompt_for_model(model_name)      ← ChatPromptTemplate per model
│  ├─ get_memory(model, use_vector)         ← window or vector memory
│  └─ get_ollama_model(model_name, temp)    ← singleton per model
│
├─ Endpoints
│  ├─ POST /chat         ← complete response
│  ├─ POST /chat/stream  ← token streaming
│  └─ POST /reset        ← reset history per model
│
└─ App events
   └─ on_startup → preload models ("mistral", "tinyllama")
```

---

## CORS Configuration

```python
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # local frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Allows the frontend (default `http://localhost:3000`) to access the API without CORS issues.

---

## Input Model

```python
class ChatRequest(BaseModel):
    user_input: str
    model: str = "mistral"
    temperature: float = 0.3
    use_vector_memory: bool = False
```

Fields:
- **user_input**: user message
- **model**: Ollama model name (e.g., `mistral`, `tinyllama`)
- **temperature**: model creativity
- **use_vector_memory**: if `True`, use vector memory

---

## Memory and Prompts

### Persistent history per model
```python
def get_history_for_model(model_name: str) -> FileChatMessageHistory:
    file_path = Path(f"chat_{model_name}_memory.json")
    return FileChatMessageHistory(str(file_path))
```

Stores and reuses history in `chat_<model>_memory.json` files.

### Prompt per model (cached)
```python
def get_prompt_for_model(model_name: str) -> ChatPromptTemplate:
    # Creates (and caches) a ChatPromptTemplate with:
    # - System message
    # - MessagesPlaceholder("history")
    # - Human message "{input}"
```

System prompts can be customized per model and are cached in `PROMPTS_CACHE`.

### Memory selection
```python
def get_memory(model: str, use_vector: bool):
    if use_vector:
        # VectorStoreRetrieverMemory (Chroma + embeddings)
    else:
        # ConversationBufferWindowMemory (k=3) + JSON history
```

Vector memory requires additional imports and dependencies:
```python
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
```
Installation: `pip install chromadb sentence-transformers`

---

## Ollama Models Management

```python
def get_ollama_model(model_name: str, temperature: float) -> ChatOllama:
    # Returns a single (singleton) instance per model from OLLAMA_MODELS
    # Updates temperature if changed
```

Prevents duplicate `ChatOllama` instances.  
Default configuration: `num_predict=400`, `top_k=40`, `top_p=0.9`, `streaming=True`.

---

## Endpoints

### POST /chat – Complete response

Builds a `ConversationChain` with `llm` + `memory` + `prompt`.  
Measures elapsed time.  

**Request**
```bash
curl -X POST http://localhost:8000/chat   -H "Content-Type: application/json"   -d '{
    "user_input": "Hello!",
    "model": "mistral",
    "temperature": 0.3,
    "use_vector_memory": false
  }'
```

**Response**
```json
{
  "response": "…assistant response…",
  "elapsed_time": 1.23
}
```

---

### POST /chat/stream – Token streaming

Uses `AsyncIteratorCallbackHandler` to emit tokens as they arrive.  
Response type: `text/plain` (stream).

**Example**
```bash
curl -N -X POST http://localhost:8000/chat/stream   -H "Content-Type: application/json"   -d '{
    "user_input": "Explain what a hash map is.",
    "model": "mistral",
    "temperature": 0.4,
    "use_vector_memory": false
  }'
```

---

### POST /reset – Reset history

Clears the JSON history file for the given model.

**Request**
```bash
curl -X POST http://localhost:8000/reset   -H "Content-Type: application/json"   -d '{
    "user_input": "",
    "model": "mistral",
    "temperature": 0.0,
    "use_vector_memory": false
  }'
```

**Response**
```json
{ "status": "ok", "message": "Conversation reset for model mistral" }
```

---

## Startup Event (model preload)

```python
@app.on_event("startup")
def preload_models():
    models_to_preload = ["mistral", "tinyllama"]
    for model in models_to_preload:
        get_ollama_model(model, temperature=0.3)
```

Preloads models to reduce latency on the first request.

---

## Running the Backend

1) Ensure **Ollama** is running and models are available:
```bash
ollama serve &
ollama pull mistral
```

2) Start the backend:
```bash
uvicorn main:app --reload
# http://localhost:8000  (docs available at /docs)
```

---

## Troubleshooting

- **Failed to connect to Ollama**  
  Ensure `ollama serve` is running and the model (e.g., `mistral`) is pulled.

- **CORS issues**  
  Make sure `allow_origins` includes your frontend URL (default `http://localhost:3000`).

- **Vector memory enabled**  
  Install additional dependencies and check permissions for `./vector_memory_<model>`.

- **High latency on first response**  
  Use the preload event (already included) and confirm that models are ready.
