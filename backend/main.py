from fastapi import FastAPI
from pydantic import BaseModel
from pathlib import Path
import time

from fastapi.middleware.cors import CORSMiddleware

from langchain_ollama import ChatOllama
from langchain_community.chat_message_histories import FileChatMessageHistory
from langchain.memory import ConversationBufferWindowMemory
from langchain.chains import ConversationChain

from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    MessagesPlaceholder,
)


from fastapi.responses import StreamingResponse
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
import asyncio


# Shared instances of Ollama models
OLLAMA_MODELS = {}

# Global dictionary for prompts
PROMPTS_CACHE = {}


app = FastAPI()

# CORS to allow connection with the local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input model for chat requests
class ChatRequest(BaseModel):
    user_input: str
    model: str = "mistral"
    temperature: float = 0.3
    use_vector_memory: bool = False  # New optional field

def get_memory(model: str, use_vector: bool):
    if use_vector:
        # Use persistent vector memory
        vector_dir = f"./vector_memory_{model}"
        embedding = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        vectorstore = Chroma(
            collection_name=f"chat_memory_{model}",
            embedding_function=embedding,
            persist_directory=vector_dir
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        return VectorStoreRetrieverMemory(
            retriever=retriever,
            memory_key="history",
            return_messages=True,
        )
    else:
        # Use window memory + JSON history
        history = get_history_for_model(model)
        return ConversationBufferWindowMemory(
            k=3,
            chat_memory=history,
            return_messages=True,
        )


# Function to get or create persistent history per model
def get_history_for_model(model_name: str) -> FileChatMessageHistory:
    file_path = Path(f"chat_{model_name}_memory.json")
    return FileChatMessageHistory(str(file_path))


def get_prompt_for_model(model_name: str) -> ChatPromptTemplate:
    if model_name not in PROMPTS_CACHE:
        print(f"Generating new ChatPromptTemplate for model: {model_name}")
        system_prompt_text = (
            "You are a helpful assistant. Always respond in English."
            if model_name == "tinyllama"
            else "You are a helpful assistant that always responds in English."
        )

        prompt = ChatPromptTemplate.from_messages([
            SystemMessagePromptTemplate.from_template(system_prompt_text),
            MessagesPlaceholder(variable_name="history"),
            HumanMessagePromptTemplate.from_template("{input}")
        ])

        PROMPTS_CACHE[model_name] = prompt
    else:
        print(f"Using cached ChatPromptTemplate for model: {model_name}")

    return PROMPTS_CACHE[model_name]


def get_ollama_model(model_name: str, temperature: float) -> ChatOllama:
    if model_name not in OLLAMA_MODELS:
        print(f"Creating unique ChatOllama instance for model: {model_name}")

        llm = ChatOllama(
            model=model_name,
            temperature=temperature,
            num_predict=400,
            top_k=40,        # (optional) restricts to the top-k options per token.
            top_p=0.9,       # (optional) uses nucleus sampling, typically 0.9
            streaming=True,  # important
        )

        OLLAMA_MODELS[model_name] = llm
    else:
        print(f"Reusing ChatOllama instance for model: {model_name}")
        # Temperature can be updated if it changes, optional:
        OLLAMA_MODELS[model_name].temperature = temperature
    return OLLAMA_MODELS[model_name]


# Chat endpoint
@app.post("/chat")
def chat_endpoint(request: ChatRequest):

    start_time = time.perf_counter()  # Start timer

    history = get_history_for_model(request.model)

    memory = ConversationBufferWindowMemory(
        k=3,
        chat_memory=history,
        return_messages=True,
    )

    llm = get_ollama_model(request.model, request.temperature)

    prompt = get_prompt_for_model(request.model)

    conversation = ConversationChain(
        llm=llm,
        memory=memory,
        prompt=prompt,
        verbose=False,
    )

    response = conversation.predict(input=request.user_input)

    end_time = time.perf_counter()  # Stop timer
    elapsed = round(end_time - start_time, 2)

    print(f"Total backend response time: {elapsed} seconds")

    return {
        "response": response,
        "elapsed_time": elapsed
    }


@app.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    history = get_history_for_model(request.model)
    memory = ConversationBufferWindowMemory(
        k=3,
        chat_memory=history,
        return_messages=True,
    )

    # Callback that captures tokens as they are generated
    callback = AsyncIteratorCallbackHandler()
    
    llm = ChatOllama(
        model=request.model,
        temperature=request.temperature,
        num_predict=500,
        top_k=40,        # (optional) restricts to the top-k options per token.
        top_p=0.9,       # (optional) uses nucleus sampling, typically 0.9
        streaming=True,
        callbacks=[callback],
    )

    prompt = get_prompt_for_model(request.model)

    conversation = ConversationChain(
        llm=llm,
        memory=memory,
        prompt=prompt,
        verbose=False,
    )

    # Launch async prediction and return tokens as they arrive
    async def token_streamer():
        task = asyncio.create_task(
            conversation.apredict(input=request.user_input)
        )
        async for token in callback.aiter():
            yield token
        await task

    return StreamingResponse(token_streamer(), media_type="text/plain")


@app.on_event("startup")
def preload_models():
    models_to_preload = ["mistral", "tinyllama"]
    print("Preloading Ollama models...")
    for model in models_to_preload:
        get_ollama_model(model, temperature=0.3)
    print("Models preloaded.")


# Endpoint to reset history per model
@app.post("/reset")
def reset_memory(request: ChatRequest):
    history = get_history_for_model(request.model)
    history.clear()
    return {"status": "ok", "message": f"Conversation reset for model {request.model}"}
